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

async function request(path, { method = 'GET', body, signal } = {}) {
  const init = { method, signal, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.'
    });
  }

  const data = await readJson(response);

  if (response.ok) {
    if (data === null) {
      throw new ApiError({
        status: response.status,
        code: 'UNEXPECTED_RESPONSE',
        message: 'The server sent an unexpected response.'
      });
    }
    return data;
  }

  // Backend errors use {"error":{"code","message","field?"}}.
  const error = data?.error;
  if (error && typeof error.code === 'string' && typeof error.message === 'string') {
    throw new ApiError({
      status: response.status,
      code: error.code,
      message: error.message,
      field: typeof error.field === 'string' ? error.field : null
    });
  }

  throw new ApiError({
    status: response.status,
    code: 'UNEXPECTED_RESPONSE',
    message: `The server returned an unexpected error (HTTP ${response.status}).`
  });
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
