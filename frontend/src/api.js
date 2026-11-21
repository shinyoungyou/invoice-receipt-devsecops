// Thin client for the backend API. Every request goes to same-origin /api,
// which the Vite dev server proxies to the Express backend.
//
// Successful responses resolve to parsed JSON. Failures always throw ApiError,
// so screens only need to handle one error shape.

const API_BASE = '/api';

export class ApiError extends Error {
  constructor({ status, code, message, field = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function send(path, init) {
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.'
    });
  }
}

// Turns a failed response into an ApiError.
// Backend errors use {"error":{"code","message","field?"}}.
async function errorFrom(response) {
  const error = (await readJson(response))?.error;
  if (error && typeof error.code === 'string' && typeof error.message === 'string') {
    return new ApiError({
      status: response.status,
      code: error.code,
      message: error.message,
      field: typeof error.field === 'string' ? error.field : null
    });
  }
  return new ApiError({
    status: response.status,
    code: 'UNEXPECTED_RESPONSE',
    message: `The server returned an unexpected error (HTTP ${response.status}).`
  });
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const init = { method, signal, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await send(path, init);
  if (!response.ok) throw await errorFrom(response);

  const data = await readJson(response);
  if (data === null) {
    throw new ApiError({
      status: response.status,
      code: 'UNEXPECTED_RESPONSE',
      message: 'The server sent an unexpected response.'
    });
  }
  return data;
}

function invoicePath(id, suffix = '') {
  return `/invoices/${encodeURIComponent(id)}${suffix}`;
}

export function createInvoice(invoice, options) {
  return request('/invoices', { ...options, method: 'POST', body: invoice });
}

// The backend rejects unknown query keys, so only send the ones that are set.
export function listInvoices({ q, limit, offset } = {}, options) {
  const params = new URLSearchParams();
  if (q !== undefined && q.trim() !== '') params.set('q', q.trim());
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  const query = params.toString();
  return request(`/invoices${query ? `?${query}` : ''}`, options);
}

export function getInvoice(id, options) {
  return request(invoicePath(id), options);
}

export function getUsdEstimate(id, options) {
  return request(invoicePath(id, '/conversion?currency=USD'), options);
}

// Takes no body: the server charges the stored CAD total, never a client amount.
export function startCheckout(id, options) {
  return request(invoicePath(id, '/checkout'), { ...options, method: 'POST' });
}

// Keeps only characters that are safe in a downloaded file name.
function receiptFilename(response, fallback) {
  const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '');
  const name = (match?.[1] ?? fallback).replaceAll(/[^\w.-]/g, '_');
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

/**
 * Downloads the PDF receipt of a paid invoice. Resolves to { blob, filename }.
 * Fails with ApiError, e.g. code INVOICE_NOT_PAID before payment is confirmed.
 */
export async function downloadReceipt(id, { signal, fallbackName = 'receipt' } = {}) {
  const response = await send(invoicePath(id, '/receipt'), {
    signal,
    headers: { Accept: 'application/pdf' }
  });
  if (!response.ok) throw await errorFrom(response);

  if (!(response.headers.get('Content-Type') ?? '').startsWith('application/pdf')) {
    throw new ApiError({
      status: response.status,
      code: 'UNEXPECTED_RESPONSE',
      message: 'The server did not send a PDF receipt.'
    });
  }
  return { blob: await response.blob(), filename: receiptFilename(response, fallbackName) };
}
