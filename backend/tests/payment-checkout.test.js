import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createStripeGateway } from '../payments/stripe-gateway.js';
import { returnUrl } from '../payments/routes.js';
import { input } from './support/invoice-api.js';
import { markPaid, startPaymentApi } from './support/payments.js';

function fakeStripe({ created = {}, retrieved = {} } = {}) {
  return {
    createCheckoutSession: mock.fn(async params => ({
      id: 'cs_test_new', url: 'https://checkout.stripe.com/c/pay/cs_test_new', status: 'open',
      client_reference_id: params.client_reference_id, currency: params.line_items[0].price_data.currency,
      amount_total: params.line_items[0].price_data.unit_amount, expires_at: 1795000000, ...created
    })),
    retrieveCheckoutSession: mock.fn(async id => ({ id, url: `https://checkout.stripe.com/c/pay/${id}`, ...retrieved })),
    verifyWebhook: () => { throw new Error('not used'); }
  };
}

const checkout = (base, id, body = {}) => fetch(`${base}/invoices/${id}/checkout`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

test('checkout charges the stored CAD total and ignores amounts sent by the client', async t => {
  const stripe = fakeStripe();
  const { base, db, createInvoice } = await startPaymentApi(t, stripe);
  const invoice = await createInvoice();
  assert.equal(invoice.totalCents, 3252);

  const response = await checkout(base, invoice.id, { amountCents: 1, currency: 'usd' });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    invoiceId: invoice.id, status: 'unpaid', checkoutSessionId: 'cs_test_new',
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_new', currency: 'CAD',
    amountCents: 3252, expiresAt: '2026-11-18T11:06:40.000Z'
  });

  assert.equal(stripe.createCheckoutSession.mock.callCount(), 1);
  const [params, options] = stripe.createCheckoutSession.mock.calls[0].arguments;
  assert.equal(params.mode, 'payment');
  assert.equal(params.client_reference_id, invoice.id);
  assert.deepEqual(params.metadata, { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
  assert.deepEqual(params.line_items, [{
    quantity: 1,
    price_data: {
      currency: 'cad', unit_amount: 3252,
      product_data: { name: `Invoice ${invoice.invoiceNumber}`, description: 'Demo Donair: 3 item(s), tax included' }
    }
  }]);
  assert.equal(params.success_url, `http://localhost:5173/invoices/${invoice.id}?checkout=success`);
  assert.equal(params.cancel_url, `http://localhost:5173/invoices/${invoice.id}?checkout=cancelled`);
  assert.deepEqual(options, { idempotencyKey: `checkout:${invoice.id}:initial` });

  const stored = db.prepare('SELECT status, stripe_checkout_session_id AS sessionId FROM invoices WHERE id = ?').get(invoice.id);
  assert.deepEqual({ ...stored }, { status: 'unpaid', sessionId: 'cs_test_new' });
});

test('checkout reuses an open session and replaces an expired one', async t => {
  const stripe = fakeStripe();
  const { base, createInvoice } = await startPaymentApi(t, stripe);
  const invoice = await createInvoice();
  await checkout(base, invoice.id);

  stripe.retrieveCheckoutSession.mock.mockImplementation(async id => ({
    id, url: 'https://checkout.stripe.com/c/pay/cs_test_new', status: 'open',
    client_reference_id: invoice.id, currency: 'cad', amount_total: invoice.totalCents
  }));
  const reused = await checkout(base, invoice.id);
  assert.equal(reused.status, 200);
  assert.equal((await reused.json()).checkoutSessionId, 'cs_test_new');
  assert.equal(stripe.createCheckoutSession.mock.callCount(), 1);
  assert.deepEqual(stripe.retrieveCheckoutSession.mock.calls[0].arguments, ['cs_test_new']);

  stripe.retrieveCheckoutSession.mock.mockImplementation(async id => ({
    id, status: 'expired', client_reference_id: invoice.id, currency: 'cad', amount_total: invoice.totalCents
  }));
  stripe.createCheckoutSession.mock.mockImplementation(async () => ({ id: 'cs_test_second', url: 'https://checkout.stripe.com/c/pay/cs_test_second' }));
  const replaced = await checkout(base, invoice.id);
  assert.equal(replaced.status, 201);
  assert.equal((await replaced.json()).checkoutSessionId, 'cs_test_second');
  assert.deepEqual(stripe.createCheckoutSession.mock.calls[1].arguments[1], {
    idempotencyKey: `checkout:${invoice.id}:cs_test_new`
  });
});

test('checkout waits for the webhook when Stripe already completed the previous session', async t => {
  const stripe = fakeStripe();
  const { base, createInvoice } = await startPaymentApi(t, stripe);
  const invoice = await createInvoice();
  await checkout(base, invoice.id);
  stripe.retrieveCheckoutSession.mock.mockImplementation(async id => ({
    id, status: 'complete', client_reference_id: invoice.id, currency: 'cad', amount_total: invoice.totalCents
  }));

  const response = await checkout(base, invoice.id);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'PAYMENT_PENDING');
  assert.equal(stripe.createCheckoutSession.mock.callCount(), 1);
});

test('checkout rejects unknown, paid, zero and oversized invoices without calling Stripe', async t => {
  const stripe = fakeStripe();
  const { base, db, createInvoice } = await startPaymentApi(t, stripe);
  const paid = await createInvoice();
  markPaid(db, paid.id);
  const zero = await createInvoice({ ...input, items: [{ description: 'Free sample', quantity: 1, unitPriceCents: 0 }] });
  const tiny = await createInvoice({ ...input, taxRateBps: 0, items: [{ description: 'Mint', quantity: 1, unitPriceCents: 49 }] });
  const huge = await createInvoice({ ...input, taxRateBps: 0, items: [{ description: 'Catering', quantity: 1, unitPriceCents: 100_000_000 }] });

  const cases = [
    ['missing', 404, 'INVOICE_NOT_FOUND'],
    [paid.id, 409, 'INVOICE_ALREADY_PAID'],
    [zero.id, 422, 'CHECKOUT_AMOUNT_UNSUPPORTED'],
    [tiny.id, 422, 'CHECKOUT_AMOUNT_UNSUPPORTED'],
    [huge.id, 422, 'CHECKOUT_AMOUNT_UNSUPPORTED']
  ];
  for (const [id, status, code] of cases) {
    const response = await checkout(base, id);
    assert.equal(response.status, status, id);
    assert.equal((await response.json()).error.code, code);
  }
  assert.equal(stripe.createCheckoutSession.mock.callCount(), 0);
});

test('checkout reports provider and configuration failures without storing a session', async t => {
  const stripe = fakeStripe();
  stripe.createCheckoutSession.mock.mockImplementation(async () => { throw new Error('secret detail sk_test_xyz'); });
  const { base, db, createInvoice } = await startPaymentApi(t, stripe);
  const invoice = await createInvoice();

  const failed = await checkout(base, invoice.id);
  assert.equal(failed.status, 502);
  const body = await failed.text();
  assert.match(body, /PAYMENT_PROVIDER_ERROR/);
  assert.doesNotMatch(body, /sk_test/);
  const stored = db.prepare('SELECT stripe_checkout_session_id AS sessionId FROM invoices WHERE id = ?').get(invoice.id);
  assert.equal(stored.sessionId, null);

  for (const env of [{}, { STRIPE_SECRET_KEY: 'sk_live_realkey' }, { STRIPE_SECRET_KEY: 'pk_test_publishable' }]) {
    const { base: otherBase, createInvoice: otherCreate } = await startPaymentApi(t, createStripeGateway(env));
    const other = await otherCreate();
    const response = await checkout(otherBase, other.id);
    assert.equal(response.status, 503, JSON.stringify(env));
    assert.equal((await response.json()).error.code, 'PAYMENTS_UNAVAILABLE');
  }
});

test('return URL templates insert the invoice ID and keep Stripe placeholders', () => {
  assert.equal(
    returnUrl('https://demo.test/pay/{INVOICE_ID}/done?session={CHECKOUT_SESSION_ID}', 'a b'),
    'https://demo.test/pay/a%20b/done?session={CHECKOUT_SESSION_ID}'
  );
  assert.throws(() => returnUrl('javascript:alert(1)', 'x'), /http or https/);
  assert.throws(() => returnUrl('/relative/{INVOICE_ID}', 'x'), /absolute/);
});
