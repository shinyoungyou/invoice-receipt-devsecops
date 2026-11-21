import { vi } from 'vitest';

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function errorResponse(status, code, message) {
  return jsonResponse(status, { error: { code, message } });
}

// A fetch mock that honours AbortSignal like the real fetch.
export function abortableFetch(respond) {
  return vi.fn((url, init = {}) => new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (init.signal?.aborted) return abort();
    init.signal?.addEventListener('abort', abort);
    Promise.resolve(respond(url, init)).then(resolve, reject);
  }));
}

export function conversion(overrides = {}) {
  return {
    invoiceId: 'inv_1',
    currency: 'CAD',
    totalCents: 2728,
    estimatedCurrency: 'USD',
    estimatedTotalCents: 2182,
    cadPerUsd: '1.2500',
    rateDate: '2026-11-09',
    source: 'Bank of Canada',
    ...overrides
  };
}

// Answers USD estimate requests separately, so tests about the invoice itself
// do not have to know the detail page also asks for an estimate.
export function withConversion(respond, respondToConversion = () => jsonResponse(200, conversion())) {
  return (url, init) => url.includes('/conversion') ? respondToConversion(url, init) : respond(url, init);
}

export function summary(overrides = {}) {
  return {
    id: 'inv_1',
    invoiceNumber: 'INV-0001',
    sellerName: 'Demo Donair Shop',
    customerName: 'Demo Customer',
    currency: 'CAD',
    status: 'unpaid',
    subtotalCents: 2598,
    taxRateBps: 500,
    taxCents: 130,
    totalCents: 2728,
    createdAt: '2026-11-19T18:00:00.000Z',
    updatedAt: '2026-11-19T18:00:00.000Z',
    paidAt: null,
    receiptUrl: null,
    ...overrides
  };
}

export function invoice(overrides = {}) {
  return {
    ...summary(),
    items: [
      { description: 'Chicken donair', quantity: 2, unitPriceCents: 1299, lineTotalCents: 2598 }
    ],
    ...overrides
  };
}
