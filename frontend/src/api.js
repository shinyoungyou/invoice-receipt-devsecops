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

// Defense in depth: every request must stay on this site and under /api/.
// User input (such as the ?q= search text) only ever reaches the query string,
// through URLSearchParams, but this check refuses any path that would leave
// the API after URL normalization, whatever its source.
function apiUrl(path) {
  const origin = globalThis.location.origin;
  const url = new URL(`${API_BASE}${path}`, origin);
  if (url.origin !== origin || !url.pathname.startsWith(`${API_BASE}/`)) {
    throw new ApiError({
      status: 0,
      code: 'INVALID_REQUEST_PATH',
      message: 'Refused to send a request outside the API.'
    });
  }
  return `${url.pathname}${url.search}`;
}

async function send(path, init) {
  const url = apiUrl(path);
  try {
    return await fetch(url, init);
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

// Invoice IDs are server-generated UUIDs. Only URL-safe characters are
// accepted, so an ID can never be "." or ".." or contain "/". Escaping alone is
// not enough: encodeURIComponent('..') is still '..', and
// /api/invoices/../checkout would resolve to /api/checkout. This is a
// client-side path traversal (CSPT), reported by SonarQube Cloud as
// jssecurity:S8476.
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function isSafeInvoiceId(id) {
  return typeof id === 'string' && SAFE_ID.test(id);
}

function invoicePath(id, suffix = '') {
  if (!isSafeInvoiceId(id)) {
    throw new ApiError({ status: 0, code: 'INVALID_INVOICE_ID', message: 'This invoice link is not valid.' });
  }
  return `/invoices/${id}${suffix}`;
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
