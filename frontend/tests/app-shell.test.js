import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { abortableFetch, errorResponse, invoice, jsonResponse, summary, withConversion } from './support/fixtures.js';

let fetchMock;

async function start(path, respond = () => jsonResponse(200, [])) {
  history.replaceState(null, '', path);
  fetchMock = abortableFetch(withConversion(respond));
  vi.stubGlobal('fetch', fetchMock);
  await import('../src/main.js');
}

const app = () => document.querySelector('#app');
const heading = () => app().querySelector('h1')?.textContent;

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

test('the home page shows the invoice list', async () => {
  await start('/');

  await vi.waitFor(() => expect(app().querySelector('.empty-state')).not.toBeNull());
  expect(heading()).toBe('Invoices');
  expect(document.title).toBe('Invoices · Invoice and Receipt Generator');
});

test('the search term is read from the URL', async () => {
  await start('/?q=donair');

  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toContain('q=donair');
  expect(app().querySelector('#invoice-search').value).toBe('donair');
});

test('/invoices/new shows the form', async () => {
  await start('/invoices/new');

  expect(heading()).toBe('New invoice');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a Stripe return URL loads that invoice and passes on the checkout result', async () => {
  await start('/invoices/inv_1?checkout=success', () => jsonResponse(200, invoice({
    status: 'paid',
    paidAt: '2026-11-19T19:30:00.000Z',
    receiptUrl: '/api/invoices/inv_1/receipt'
  })));

  await vi.waitFor(() => expect(heading()).toBe('Invoice INV-0001'));
  expect(fetchMock.mock.calls[0][0]).toBe('/api/invoices/inv_1');
  expect(document.title).toBe('INV-0001 · Invoice and Receipt Generator');
  expect(app().querySelector('.payment-message').textContent).toMatch(/^Payment confirmed\. Paid on /);
});

test('a missing invoice keeps the generic title', async () => {
  await start('/invoices/missing', () => errorResponse(404, 'INVOICE_NOT_FOUND', 'Invoice not found.'));

  await vi.waitFor(() => expect(heading()).toBe('Invoice not found'));
  expect(document.title).toBe('Invoice · Invoice and Receipt Generator');
});

test('unknown paths show a not-found page', async () => {
  await start('/settings');

  expect(heading()).toBe('Page not found');
  expect(app().querySelector('a').getAttribute('href')).toBe('/');
});

test('clicking a row opens the invoice and moves focus to its heading', async () => {
  await start('/', url => url.startsWith('/api/invoices/')
    ? jsonResponse(200, invoice())
    : jsonResponse(200, [summary()]));
  await vi.waitFor(() => expect(app().querySelector('tbody a')).not.toBeNull());

  app().querySelector('tbody a').click();

  await vi.waitFor(() => expect(heading()).toBe('Invoice INV-0001'));
  expect(location.pathname).toBe('/invoices/inv_1');
  expect(document.activeElement).toBe(app().querySelector('h1'));
});

test('creating an invoice opens its detail page', async () => {
  await start('/invoices/new', (url, init) => init.method === 'POST'
    ? jsonResponse(201, invoice({ id: 'inv_new', invoiceNumber: 'INV-NEW' }))
    : jsonResponse(200, invoice({ id: 'inv_new', invoiceNumber: 'INV-NEW' })));
  const set = (field, value) => { app().querySelector(`[data-field="${field}"]`).value = value; };
  set('sellerName', 'Seller');
  set('customerName', 'Customer');
  set('items[0].description', 'Item');
  set('items[0].unitPriceCents', '5');

  app().querySelector('button[type="submit"]').click();

  await vi.waitFor(() => expect(heading()).toBe('Invoice INV-NEW'));
  expect(location.pathname).toBe('/invoices/inv_new');
});

test('leaving a page cancels its request so a late response cannot replace the new page', async () => {
  let slowSignal;
  await start('/invoices/slow', (url, init) => {
    slowSignal = init.signal;
    return new Promise(() => {});
  });

  history.pushState(null, '', '/invoices/new');
  window.dispatchEvent(new PopStateEvent('popstate'));

  expect(slowSignal.aborted).toBe(true);
  expect(heading()).toBe('New invoice');
});

test('an unexpected error while rendering shows a message instead of a stuck loading screen', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  // A malformed invoice (items missing) makes the detail view throw a TypeError.
  await start('/invoices/inv_1', () => jsonResponse(200, invoice({ items: null })));

  await vi.waitFor(() => expect(app().querySelector('[role="alert"]')).not.toBeNull());
  expect(app().textContent).toContain('Something went wrong while showing this page.');
  expect(app().querySelector('[role="status"]')).toBeNull();
  expect(consoleError).toHaveBeenCalledWith(expect.any(TypeError));
  consoleError.mockRestore();
});
