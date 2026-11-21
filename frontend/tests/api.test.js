import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ApiError,
  createInvoice,
  downloadReceipt,
  getInvoice,
  getUsdEstimate,
  listInvoices,
  startCheckout
} from '../src/api.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requests', () => {
  test('createInvoice posts JSON and returns the created invoice', async () => {
    const invoice = { sellerName: 'Demo Donair Shop', taxRateBps: 500, items: [] };
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'inv_1', totalCents: 2728 }));

    const result = await createInvoice(invoice);

    expect(result).toEqual({ id: 'inv_1', totalCents: 2728 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/invoices');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual(invoice);
  });

  test('listInvoices sends only the parameters that are set', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, []));

    await listInvoices();
    await listInvoices({ q: '  donair ', limit: 20, offset: 40 });
    await listInvoices({ q: '   ' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/invoices',
      '/api/invoices?q=donair&limit=20&offset=40',
      '/api/invoices'
    ]);
  });

  test('invoice IDs are URL-encoded', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, {}));

    await getInvoice('inv/../1');
    await getUsdEstimate('inv_1');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/invoices/inv%2F..%2F1',
      '/api/invoices/inv_1/conversion?currency=USD'
    ]);
  });

  test('startCheckout posts without a body so the client cannot set the amount', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { checkoutUrl: 'https://checkout.stripe.com/x' }));

    await startCheckout('inv_1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/invoices/inv_1/checkout');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });
});

describe('errors', () => {
  test('backend error envelope becomes an ApiError with code and field', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, {
      error: { code: 'INVALID_INVOICE', message: 'Quantity must be an integer.', field: 'items[0].quantity' }
    }));

    const error = await createInvoice({}).catch(err => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'INVALID_INVOICE',
      message: 'Quantity must be an integer.',
      field: 'items[0].quantity'
    });
  });

  test('errors without a field have field null', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {
      error: { code: 'RATE_UNAVAILABLE', message: 'Rate unavailable.' }
    }));

    await expect(getUsdEstimate('inv_1')).rejects.toMatchObject({
      status: 503,
      code: 'RATE_UNAVAILABLE',
      field: null
    });
  });

  test('non-JSON error responses become UNEXPECTED_RESPONSE', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    await expect(getInvoice('inv_1')).rejects.toMatchObject({
      status: 502,
      code: 'UNEXPECTED_RESPONSE'
    });
  });

  test('JSON errors without the envelope shape become UNEXPECTED_RESPONSE', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'oops' }));

    await expect(getInvoice('inv_1')).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });

  test('a successful response that is not JSON is rejected', async () => {
    fetchMock.mockResolvedValue(new Response('<html></html>', { status: 200 }));

    await expect(getInvoice('inv_1')).rejects.toMatchObject({
      status: 200,
      code: 'UNEXPECTED_RESPONSE'
    });
  });

  test('a network failure becomes NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(listInvoices()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  test('an aborted request is rethrown unchanged', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValue(abort);

    await expect(listInvoices()).rejects.toBe(abort);
  });
});

describe('downloadReceipt', () => {
  const pdf = (headers = {}) => new Response('%PDF-1.4 demo', {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="receipt-INV-0001.pdf"',
      ...headers
    }
  });

  test('downloads the PDF with the file name from the server', async () => {
    fetchMock.mockResolvedValue(pdf());

    const { blob, filename } = await downloadReceipt('inv/1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/invoices/inv%2F1/receipt');
    expect(init.headers.Accept).toBe('application/pdf');
    expect(await blob.text()).toBe('%PDF-1.4 demo');
    expect(filename).toBe('receipt-INV-0001.pdf');
  });

  test('cleans unsafe characters out of the file name', async () => {
    fetchMock.mockResolvedValue(pdf({ 'Content-Disposition': 'attachment; filename="../../etc/pass wd.pdf"' }));

    const { filename } = await downloadReceipt('inv_1');

    expect(filename).toBe('.._.._etc_pass_wd.pdf');
    expect(filename).not.toContain('/');
  });

  test('falls back to the given name and always ends in .pdf', async () => {
    fetchMock.mockResolvedValue(pdf({ 'Content-Disposition': 'attachment' }));

    const { filename } = await downloadReceipt('inv_1', { fallbackName: 'receipt-INV-0001' });

    expect(filename).toBe('receipt-INV-0001.pdf');
  });

  test('a receipt requested before payment fails with INVOICE_NOT_PAID', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, {
      error: { code: 'INVOICE_NOT_PAID', message: 'Invoice is not paid.' }
    }));

    await expect(downloadReceipt('inv_1')).rejects.toMatchObject({
      status: 409,
      code: 'INVOICE_NOT_PAID',
      message: 'Invoice is not paid.'
    });
  });

  test('a response that is not a PDF is rejected', async () => {
    fetchMock.mockResolvedValue(new Response('<html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    }));

    await expect(downloadReceipt('inv_1')).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });

  test('a network failure becomes NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(downloadReceipt('inv_1')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
