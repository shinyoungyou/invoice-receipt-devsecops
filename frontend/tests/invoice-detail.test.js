import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { renderInvoiceDetail } from '../src/views/invoice-detail.js';
import { abortableFetch, errorResponse, invoice, jsonResponse } from './support/fixtures.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
  vi.unstubAllGlobals();
});

function stubFetch(respond) {
  const fetchMock = abortableFetch(respond);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const text = selector => container.querySelector(selector)?.textContent;
const footerRows = () => [...container.querySelectorAll('tfoot tr')].map(row =>
  [...row.children].map(cell => cell.textContent));

test('shows a loading message, then the invoice with server totals', async () => {
  let respond;
  const fetchMock = stubFetch(() => new Promise(resolve => { respond = resolve; }));

  const done = renderInvoiceDetail(container, { id: 'inv/1' });
  expect(text('[role="status"]')).toBe('Loading invoice…');
  expect(fetchMock.mock.calls[0][0]).toBe('/api/invoices/inv%2F1');

  respond(jsonResponse(200, invoice({
    items: [
      { description: 'Chicken donair', quantity: 2, unitPriceCents: 1299, lineTotalCents: 2598 },
      { description: 'Fries', quantity: 1000, unitPriceCents: 115, lineTotalCents: 115000 }
    ],
    subtotalCents: 117598,
    taxCents: 5880,
    totalCents: 123478
  })));
  const result = await done;

  expect(result.id).toBe('inv_1');
  expect(text('h1')).toBe('Invoice INV-0001');
  expect(text('.status-badge')).toBe('Unpaid');
  expect(text('dl')).toContain('Demo Donair Shop');
  expect(text('dl')).toContain('Demo Customer');

  const items = [...container.querySelectorAll('tbody tr')].map(row =>
    [...row.children].map(cell => cell.textContent));
  expect(items).toEqual([
    ['Chicken donair', '2', '$12.99', '$25.98'],
    ['Fries', '1,000', '$1.15', '$1,150.00']
  ]);
  expect(footerRows()).toEqual([
    ['Subtotal', '$1,175.98'],
    ['Tax (5%)', '$58.80'],
    ['Total (CAD)', '$1,234.78']
  ]);
});

test('shows the tax-exempt rate', async () => {
  stubFetch(() => jsonResponse(200, invoice({ taxRateBps: 0, taxCents: 0, totalCents: 2598 })));

  await renderInvoiceDetail(container, { id: 'inv_1' });

  expect(footerRows()[1]).toEqual(['Tax (0%)', '$0.00']);
});

test('a paid invoice shows the Paid badge and payment date', async () => {
  stubFetch(() => jsonResponse(200, invoice({
    status: 'paid',
    paidAt: '2026-11-19T19:30:00.000Z',
    receiptUrl: '/api/invoices/inv_1/receipt'
  })));

  await renderInvoiceDetail(container, { id: 'inv_1' });

  expect(text('.status-badge')).toBe('Paid');
  expect(text('header p')).toMatch(/^Created .+ · Paid .+$/);
});

test('an unpaid invoice shows no payment date', async () => {
  stubFetch(() => jsonResponse(200, invoice()));

  await renderInvoiceDetail(container, { id: 'inv_1' });

  expect(text('header p')).not.toContain('Paid');
});

test('renders stored text as text, not HTML', async () => {
  stubFetch(() => jsonResponse(200, invoice({
    sellerName: '<script>alert(1)</script>',
    items: [{ description: '<img src=x onerror=alert(1)>', quantity: 1, unitPriceCents: 100, lineTotalCents: 100 }]
  })));

  await renderInvoiceDetail(container, { id: 'inv_1' });

  expect(container.querySelector('script, img')).toBeNull();
  expect(text('dl')).toContain('<script>alert(1)</script>');
  expect(text('tbody td')).toBe('<img src=x onerror=alert(1)>');
});

test('an unknown invoice shows a not-found page with a way back', async () => {
  stubFetch(() => errorResponse(404, 'INVOICE_NOT_FOUND', 'Invoice not found.'));

  const result = await renderInvoiceDetail(container, { id: 'missing' });

  expect(result).toBeNull();
  expect(text('h1')).toBe('Invoice not found');
  expect(container.querySelector('a[data-link]').getAttribute('href')).toBe('/');
});

test('other errors show a banner whose retry loads the invoice', async () => {
  let calls = 0;
  stubFetch(() => {
    calls += 1;
    return calls === 1
      ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
      : jsonResponse(200, invoice());
  });

  await renderInvoiceDetail(container, { id: 'inv_1' });
  expect(text('[role="alert"]')).toContain('Could not load this invoice. An unexpected error occurred.');

  container.querySelector('button.retry').click();
  await vi.waitFor(() => expect(text('h1')).toBe('Invoice INV-0001'));
});

test('renders nothing more once its request is aborted', async () => {
  stubFetch(() => new Promise(() => {}));
  const controller = new AbortController();

  const done = renderInvoiceDetail(container, { id: 'inv_1', signal: controller.signal });
  controller.abort();

  expect(await done).toBeNull();
  expect(text('[role="status"]')).toBe('Loading invoice…');
});

test('an unexpected error after retrying shows a message instead of being lost', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  let calls = 0;
  stubFetch(() => {
    calls += 1;
    return calls === 1
      ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
      : jsonResponse(200, invoice({ items: null }));
  });
  await renderInvoiceDetail(container, { id: 'inv_1' });

  container.querySelector('button.retry').click();

  await vi.waitFor(() => expect(text('[role="alert"]')).toContain('Something went wrong while showing this page.'));
  expect(container.querySelector('button.retry')).toBeNull();
  consoleError.mockRestore();
});
