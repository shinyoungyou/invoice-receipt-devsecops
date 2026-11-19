import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PAGE_SIZE, renderInvoiceList } from '../src/views/invoice-list.js';
import { abortableFetch, errorResponse, jsonResponse, summary } from './support/fixtures.js';

let container;

beforeEach(() => {
  history.replaceState(null, '', '/');
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

const rows = () => container.querySelectorAll('tbody tr');
const cells = row => [...row.querySelectorAll('td')].map(td => td.textContent);

test('shows a loading message, then one row per invoice', async () => {
  let respond;
  stubFetch(() => new Promise(resolve => { respond = resolve; }));

  const done = renderInvoiceList(container);
  expect(container.querySelector('[role="status"]').textContent).toBe('Loading invoices…');

  respond(jsonResponse(200, [
    summary(),
    summary({ id: 'inv 2', invoiceNumber: 'INV-0002', totalCents: 272800, status: 'paid' })
  ]));
  await done;

  expect(rows()).toHaveLength(2);
  expect(cells(rows()[0]).slice(0, 5)).toEqual(['INV-0001', 'Demo Donair Shop', 'Demo Customer', '$27.28', 'Unpaid']);
  expect(cells(rows()[1])[3]).toBe('$2,728.00');
  expect(cells(rows()[1])[4]).toBe('Paid');
  expect(rows()[1].querySelector('a').getAttribute('href')).toBe('/invoices/inv%202');
  expect(rows()[1].querySelector('a').hasAttribute('data-link')).toBe(true);
});

test('requests the first page and passes the search term', async () => {
  const fetchMock = stubFetch(() => jsonResponse(200, []));

  await renderInvoiceList(container, { query: 'donair' });

  expect(fetchMock.mock.calls[0][0]).toBe(`/api/invoices?q=donair&limit=${PAGE_SIZE}&offset=0`);
  expect(container.querySelector('#invoice-search').value).toBe('donair');
});

test('has a labelled search box and a link to create an invoice', async () => {
  stubFetch(() => jsonResponse(200, []));

  await renderInvoiceList(container);

  expect(container.querySelector('label[for="invoice-search"]').textContent).toBe('Search invoices');
  expect(container.querySelector('a.new-invoice').getAttribute('href')).toBe('/invoices/new');
});

test('shows an empty state when there are no invoices', async () => {
  stubFetch(() => jsonResponse(200, []));

  await renderInvoiceList(container);

  expect(container.querySelector('.empty-state').textContent).toBe('No invoices yet. Create your first one.');
  expect(container.querySelector('table')).toBeNull();
});

test('shows the search term in the no-results message as plain text', async () => {
  stubFetch(() => jsonResponse(200, []));
  const query = '<img src=x onerror=alert(1)>';

  await renderInvoiceList(container, { query });

  expect(container.querySelector('.empty-state').textContent).toBe(`No invoices match “${query}”.`);
  expect(container.querySelector('img')).toBeNull();
});

test('renders invoice names as text, not HTML', async () => {
  stubFetch(() => jsonResponse(200, [summary({ customerName: '<b onclick=alert(1)>Bold</b>' })]));

  await renderInvoiceList(container);

  expect(cells(rows()[0])[2]).toBe('<b onclick=alert(1)>Bold</b>');
  expect(container.querySelector('tbody b')).toBeNull();
});

test('submitting a search puts the trimmed term in the URL', async () => {
  stubFetch(() => jsonResponse(200, []));
  const onPopState = vi.fn();
  window.addEventListener('popstate', onPopState);
  await renderInvoiceList(container);

  container.querySelector('#invoice-search').value = '  donair shop ';
  container.querySelector('form[role="search"] button').click();

  expect(location.pathname + location.search).toBe('/?q=donair%20shop');
  expect(onPopState).toHaveBeenCalledOnce();

  container.querySelector('#invoice-search').value = '   ';
  container.querySelector('form[role="search"] button').click();
  expect(location.pathname + location.search).toBe('/');
  window.removeEventListener('popstate', onPopState);
});

test('shows an error with a retry button that reloads the list', async () => {
  const fetchMock = stubFetch(() => fetchMock.mock.calls.length === 1
    ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
    : jsonResponse(200, [summary()]));

  await renderInvoiceList(container);

  const banner = container.querySelector('[role="alert"]');
  expect(banner.textContent).toContain('Could not load invoices. An unexpected error occurred.');

  banner.querySelector('button.retry').click();
  await vi.waitFor(() => expect(rows()).toHaveLength(1));
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('offers "Load more" only when a full page came back', async () => {
  const page = (offset, count) => Array.from({ length: count }, (_, i) =>
    summary({ id: `inv_${offset + i}`, invoiceNumber: `INV-${offset + i}` }));
  const fetchMock = stubFetch(url => {
    const offset = Number(new URL(url, 'http://x').searchParams.get('offset'));
    return jsonResponse(200, offset === 0 ? page(0, PAGE_SIZE) : page(offset, 3));
  });

  await renderInvoiceList(container);
  expect(rows()).toHaveLength(PAGE_SIZE);

  container.querySelector('.load-more').click();
  await vi.waitFor(() => expect(rows()).toHaveLength(PAGE_SIZE + 3));

  expect(fetchMock.mock.calls[1][0]).toContain(`offset=${PAGE_SIZE}`);
  expect(cells(rows()[PAGE_SIZE])[0]).toBe(`INV-${PAGE_SIZE}`);
  expect(container.querySelector('.load-more')).toBeNull();
});

test('a failed "Load more" keeps the rows already shown and can be retried', async () => {
  const full = Array.from({ length: PAGE_SIZE }, (_, i) => summary({ id: `inv_${i}` }));
  let failNext = false;
  stubFetch(url => {
    if (url.includes('offset=0')) return jsonResponse(200, full);
    if (failNext) {
      failNext = false;
      return errorResponse(503, 'UNAVAILABLE', 'Try later.');
    }
    return jsonResponse(200, [summary({ id: 'extra' })]);
  });
  await renderInvoiceList(container);

  failNext = true;
  container.querySelector('.load-more').click();
  await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());

  expect(rows()).toHaveLength(PAGE_SIZE);
  expect(container.querySelector('.load-more').disabled).toBe(false);

  container.querySelector('[role="alert"] button.retry').click();
  await vi.waitFor(() => expect(rows()).toHaveLength(PAGE_SIZE + 1));
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('renders nothing more once its request is aborted', async () => {
  stubFetch(() => new Promise(() => {}));
  const controller = new AbortController();

  const done = renderInvoiceList(container, { signal: controller.signal });
  controller.abort();
  await done;

  expect(container.querySelector('[role="status"]').textContent).toBe('Loading invoices…');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('an unexpected error after retrying shows a message instead of being lost', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  let calls = 0;
  stubFetch(() => {
    calls += 1;
    return calls === 1
      ? errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
      : jsonResponse(200, [summary({ totalCents: 'not cents' })]);
  });
  await renderInvoiceList(container);

  container.querySelector('button.retry').click();

  await vi.waitFor(() => expect(container.textContent).toContain('Something went wrong while showing this page.'));
  expect(consoleError).toHaveBeenCalledWith(expect.any(TypeError));
  consoleError.mockRestore();
});

test('an unexpected error from "Load more" shows a message instead of being lost', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const full = Array.from({ length: PAGE_SIZE }, (_, i) => summary({ id: `inv_${i}` }));
  stubFetch(url => url.includes('offset=0')
    ? jsonResponse(200, full)
    : jsonResponse(200, [summary({ totalCents: 1.5 })]));
  await renderInvoiceList(container);

  container.querySelector('.load-more').click();

  await vi.waitFor(() => expect(container.textContent).toContain('Something went wrong while showing this page.'));
  consoleError.mockRestore();
});
