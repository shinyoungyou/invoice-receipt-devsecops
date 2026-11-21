import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { goToStripeCheckout, saveFile } from '../src/external.js';
import { renderInvoiceDetail } from '../src/views/invoice-detail.js';
import { POLL_ATTEMPTS, POLL_INTERVAL_MS, showPayment } from '../src/views/payment.js';
import { abortableFetch, errorResponse, invoice, jsonResponse, withConversion } from './support/fixtures.js';

vi.mock('../src/external.js', async importOriginal => ({
  ...(await importOriginal()),
  goToStripeCheckout: vi.fn(),
  saveFile: vi.fn()
}));

const STRIPE_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1B2c3';
const paidInvoice = () => invoice({
  status: 'paid',
  paidAt: '2026-11-19T19:30:00.000Z',
  receiptUrl: '/api/invoices/inv_1/receipt'
});
const session = (overrides = {}) => ({
  invoiceId: 'inv_1',
  status: 'unpaid',
  checkoutSessionId: 'cs_test_a1B2c3',
  checkoutUrl: STRIPE_URL,
  currency: 'CAD',
  amountCents: 2728,
  expiresAt: '2026-11-19T18:00:00.000Z',
  ...overrides
});

let section;
let onPaid;
let fetchMock;

function stubFetch(respond) {
  fetchMock = abortableFetch(withConversion(respond));
  vi.stubGlobal('fetch', fetchMock);
}

const requests = method => fetchMock.mock.calls.filter(([url, init = {}]) =>
  (init.method ?? 'GET') === method && !url.includes('/conversion'));
const messageText = () => section.querySelector('.payment-message')?.textContent;
const payButton = () => section.querySelector('button.pay');

function show(options = {}) {
  showPayment(section, { invoice: invoice(), onPaid, ...options });
}

beforeEach(() => {
  section = document.createElement('section');
  document.body.append(section);
  onPaid = vi.fn();
  vi.mocked(goToStripeCheckout).mockClear();
  vi.mocked(saveFile).mockClear();
});

afterEach(() => {
  section.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('unpaid invoice', () => {
  test('offers to pay the CAD total with a test-mode hint', () => {
    stubFetch(() => jsonResponse(201, session()));

    show();

    expect(payButton().textContent).toBe('Pay $27.28 CAD with Stripe');
    expect(section.textContent).toContain('Stripe test mode: use card 4242 4242 4242 4242');
    expect(messageText()).toBeUndefined();
  });

  test('starts checkout without sending an amount and goes to Stripe', async () => {
    stubFetch(() => jsonResponse(201, session()));
    show();

    payButton().click();

    expect(payButton().disabled).toBe(true);
    expect(payButton().textContent).toBe('Opening Stripe…');
    await vi.waitFor(() => expect(goToStripeCheckout).toHaveBeenCalledWith(STRIPE_URL));
    const [url, init] = requests('POST')[0];
    expect(url).toBe('/api/invoices/inv_1/checkout');
    expect(init.body).toBeUndefined();
  });

  test('refuses to open a payment page that is not Stripe', async () => {
    stubFetch(() => jsonResponse(201, session({ checkoutUrl: 'https://checkout.stripe.com.evil.example/pay' })));
    show();

    payButton().click();

    await vi.waitFor(() => expect(messageText()).toBe('The server returned an unexpected payment page, so it was not opened.'));
    expect(goToStripeCheckout).not.toHaveBeenCalled();
    expect(payButton().disabled).toBe(false);
  });

  test.each([
    [503, 'PAYMENTS_UNAVAILABLE', 'Payments are not configured on this server.'],
    [502, 'PAYMENT_PROVIDER_ERROR', 'Stripe rejected the request.']
  ])('a %s error shows the reason and lets the user try again', async (status, code, text) => {
    let attempts = 0;
    stubFetch(() => {
      attempts += 1;
      return attempts === 1 ? errorResponse(status, code, text) : jsonResponse(200, session());
    });
    show();

    payButton().click();
    await vi.waitFor(() => expect(messageText()).toBe(`Could not start the payment. ${text}`));
    expect(payButton().disabled).toBe(false);

    payButton().click();
    await vi.waitFor(() => expect(goToStripeCheckout).toHaveBeenCalledWith(STRIPE_URL));
  });

  test('an amount Stripe cannot charge shows the reason and no pay button', async () => {
    stubFetch(() => errorResponse(422, 'CHECKOUT_AMOUNT_UNSUPPORTED', 'Total must be between $0.50 and $999,999.99 CAD.'));
    show();

    payButton().click();

    await vi.waitFor(() => expect(messageText()).toBe('Total must be between $0.50 and $999,999.99 CAD.'));
    expect(payButton()).toBeNull();
  });

  test.each(['PAYMENT_PENDING', 'INVOICE_ALREADY_PAID'])('a 409 %s waits for the server to confirm', async code => {
    stubFetch((url, init = {}) => init.method === 'POST'
      ? errorResponse(409, code, 'Already handled.')
      : jsonResponse(200, paidInvoice()));
    show();

    payButton().click();

    await vi.waitFor(() => expect(onPaid).toHaveBeenCalledWith(paidInvoice()));
    expect(goToStripeCheckout).not.toHaveBeenCalled();
  });
});

describe('returning from Stripe', () => {
  test('a cancelled checkout says nothing was charged and offers to pay again', () => {
    stubFetch(() => jsonResponse(201, session()));

    show({ checkout: 'cancelled' });

    expect(messageText()).toBe('Payment was cancelled. You have not been charged.');
    expect(payButton()).not.toBeNull();
  });

  test('a success redirect alone does not mark the invoice paid', () => {
    stubFetch(() => new Promise(() => {}));

    show({ checkout: 'success' });

    expect(messageText()).toBe('Payment received by Stripe. Waiting for confirmation… This page updates automatically.');
    expect(payButton()).toBeNull();
    expect(onPaid).not.toHaveBeenCalled();
  });

  test('polls the invoice until the webhook has marked it paid', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const answers = [invoice(), invoice(), paidInvoice()];
    stubFetch(() => jsonResponse(200, answers.shift()));

    show({ checkout: 'success' });

    await vi.advanceTimersByTimeAsync(0);
    expect(requests('GET')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1);
    expect(requests('GET')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests('GET')).toHaveLength(2);
    expect(onPaid).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(requests('GET')).toHaveLength(3);
    expect(onPaid).toHaveBeenCalledWith(paidInvoice());
    expect(requests('GET')[0][0]).toBe('/api/invoices/inv_1');
  });

  test('a failed check is retried on the next attempt', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const answers = [errorResponse(500, 'INTERNAL_ERROR', 'Boom.'), jsonResponse(200, paidInvoice())];
    stubFetch(() => answers.shift());

    show({ checkout: 'success' });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(onPaid).toHaveBeenCalledOnce();
  });

  test('gives up after the last attempt and can check again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let paid = false;
    stubFetch(() => jsonResponse(200, paid ? paidInvoice() : invoice()));

    show({ checkout: 'success' });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * POLL_ATTEMPTS);

    expect(requests('GET')).toHaveLength(POLL_ATTEMPTS);
    expect(messageText()).toBe('Stripe has not confirmed this payment yet. You will not be charged twice; check again in a minute.');
    expect(onPaid).not.toHaveBeenCalled();

    paid = true;
    section.querySelector('button.check-again').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(onPaid).toHaveBeenCalledWith(paidInvoice());
  });

  test('leaving the page stops polling', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stubFetch(() => jsonResponse(200, invoice()));
    const controller = new AbortController();

    show({ checkout: 'success', signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * POLL_ATTEMPTS);

    expect(requests('GET')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('paid invoice', () => {
  test('shows when it was paid and no pay button', () => {
    show({ invoice: paidInvoice() });

    expect(messageText()).toMatch(/^Paid on Nov 19, 2026/);
    expect(payButton()).toBeNull();
  });

  test('right after a successful checkout it says the payment is confirmed', () => {
    show({ invoice: paidInvoice(), checkout: 'success' });

    expect(messageText()).toMatch(/^Payment confirmed\. Paid on /);
  });
});

test('the detail page redraws as paid once polling sees the payment', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const container = document.createElement('div');
  document.body.append(container);
  const answers = [invoice(), invoice(), paidInvoice()];
  stubFetch(() => jsonResponse(200, answers.shift()));

  await renderInvoiceDetail(container, { id: 'inv_1', checkout: 'success' });
  expect(container.querySelector('.status-badge').textContent).toBe('Unpaid');

  await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

  expect(container.querySelector('.status-badge').textContent).toBe('Paid');
  expect(container.querySelector('.payment-message').textContent).toMatch(/^Payment confirmed\. Paid on /);
  container.remove();
});

describe('receipt', () => {
  const pdfResponse = () => new Response('%PDF-1.4', {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="receipt-INV-0001.pdf"'
    }
  });
  const receiptButton = () => section.querySelector('button.download-receipt');
  const receiptError = () => section.querySelector('.receipt-error');

  test('an unpaid invoice has no receipt button', () => {
    stubFetch(() => jsonResponse(201, session()));

    show();

    expect(receiptButton()).toBeNull();
  });

  test('a paid invoice without a receipt URL says the receipt is not ready', () => {
    show({ invoice: invoice({ status: 'paid', paidAt: '2026-11-19T19:30:00.000Z', receiptUrl: null }) });

    expect(receiptButton()).toBeNull();
    expect(section.textContent).toContain('The receipt is not available yet.');
  });

  test('a paid invoice downloads its PDF receipt', async () => {
    let respond;
    stubFetch(() => new Promise(resolve => { respond = resolve; }));
    show({ invoice: paidInvoice() });

    receiptButton().click();

    expect(receiptButton().disabled).toBe(true);
    expect(receiptButton().textContent).toBe('Preparing receipt…');
    respond(pdfResponse());
    await vi.waitFor(() => expect(saveFile).toHaveBeenCalledOnce());
    const [blob, filename] = vi.mocked(saveFile).mock.calls[0];
    expect(await blob.text()).toBe('%PDF-1.4');
    expect(filename).toBe('receipt-INV-0001.pdf');
    expect(requests('GET')[0][0]).toBe('/api/invoices/inv_1/receipt');
    expect(receiptButton().disabled).toBe(false);
    expect(receiptButton().textContent).toBe('Download receipt (PDF)');
    expect(receiptError().hidden).toBe(true);
  });

  test('a rejected receipt request explains that payment must be confirmed', async () => {
    stubFetch(() => errorResponse(409, 'INVOICE_NOT_PAID', 'Invoice is not paid.'));
    show({ invoice: paidInvoice() });

    receiptButton().click();

    await vi.waitFor(() => expect(receiptError().hidden).toBe(false));
    expect(receiptError().textContent).toBe('The receipt is available once the payment is confirmed.');
    expect(receiptError().getAttribute('role')).toBe('alert');
    expect(saveFile).not.toHaveBeenCalled();
    expect(receiptButton().disabled).toBe(false);
  });

  test('other receipt errors show the reason, and the message clears on retry', async () => {
    const answers = [errorResponse(500, 'INTERNAL_ERROR', 'Could not render the PDF.'), pdfResponse()];
    stubFetch(() => answers.shift());
    show({ invoice: paidInvoice() });

    receiptButton().click();
    await vi.waitFor(() => expect(receiptError().textContent).toBe('Could not download the receipt. Could not render the PDF.'));

    receiptButton().click();
    expect(receiptError().hidden).toBe(true);
    await vi.waitFor(() => expect(saveFile).toHaveBeenCalledOnce());
  });
});
