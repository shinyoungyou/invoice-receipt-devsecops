import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStripeGateway } from '../payments/stripe-gateway.js';
import {
  checkoutSessionEvent, deliver, postWebhook, processedEvents, signedHeader, startPaymentApi
} from './support/payments.js';

const detail = (url, id) => fetch(`${url}/${id}`).then(response => response.json());

test('a verified paid checkout event marks the invoice paid and records the event', async t => {
  const { base, db, url, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();

  const response = await deliver(base, checkoutSessionEvent(invoice));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, result: 'paid' });

  const paid = await detail(url, invoice.id);
  assert.equal(paid.status, 'paid');
  assert.match(paid.paidAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(paid.updatedAt, paid.paidAt);
  assert.equal(paid.receiptUrl, `/api/invoices/${invoice.id}/receipt`);
  assert.equal(paid.totalCents, invoice.totalCents);
  assert.deepEqual(processedEvents(db).map(row => ({ ...row })), [
    { eventId: 'evt_test_paid', invoiceId: invoice.id, eventType: 'checkout.session.completed' }
  ]);
  const session = db.prepare('SELECT stripe_checkout_session_id AS id FROM invoices WHERE id = ?').get(invoice.id);
  assert.equal(session.id, 'cs_test_paid');
});

test('missing, invalid and tampered signatures are rejected without changing state', async t => {
  const { base, db, url, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();
  const payload = JSON.stringify(checkoutSessionEvent(invoice));
  const tampered = payload.replace(`"amount_total":${invoice.totalCents}`, '"amount_total":1');
  assert.notEqual(tampered, payload);

  const attempts = [
    postWebhook(base, payload, {}),
    postWebhook(base, payload, { 'Stripe-Signature': 'garbage' }),
    postWebhook(base, payload, { 'Stripe-Signature': signedHeader(payload, 'whsec_attacker_secret') }),
    postWebhook(base, tampered, { 'Stripe-Signature': signedHeader(payload) }),
    postWebhook(base, payload, { 'Stripe-Signature': signedHeader(payload), 'Content-Type': 'text/plain' })
  ];
  for (const response of await Promise.all(attempts)) {
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_SIGNATURE');
  }
  assert.equal((await detail(url, invoice.id)).status, 'unpaid');
  assert.deepEqual(processedEvents(db), []);
});

test('incorrect amount, currency, mode or invoice identity never marks an invoice paid', async t => {
  const { base, db, url, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();
  const other = await createInvoice();

  const cases = [
    [{ amount_total: invoice.totalCents - 1 }, 422, 'PAYMENT_MISMATCH'],
    [{ amount_total: invoice.totalCents + 1 }, 422, 'PAYMENT_MISMATCH'],
    [{ currency: 'usd' }, 422, 'PAYMENT_MISMATCH'],
    [{ mode: 'subscription' }, 422, 'PAYMENT_MISMATCH'],
    [{ metadata: { invoiceId: other.id } }, 400, 'INVALID_EVENT'],
    [{ client_reference_id: null }, 400, 'INVALID_EVENT'],
    [{ client_reference_id: 'unknown', metadata: {} }, 404, 'INVOICE_NOT_FOUND']
  ];
  for (const [index, [session, status, code]] of cases.entries()) {
    const response = await deliver(base, checkoutSessionEvent(invoice, { id: `evt_bad_${index}`, session }));
    assert.equal(response.status, status, JSON.stringify(session));
    assert.equal((await response.json()).error.code, code);
  }
  assert.equal((await detail(url, invoice.id)).status, 'unpaid');
  assert.equal((await detail(url, other.id)).status, 'unpaid');
  assert.deepEqual(processedEvents(db), []);
});

test('unpaid, failed and expired sessions leave the invoice unpaid until payment succeeds', async t => {
  const { base, db, url, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();

  const pending = await deliver(base, checkoutSessionEvent(invoice, { id: 'evt_pending', session: { payment_status: 'unpaid' } }));
  assert.deepEqual(await pending.json(), { received: true, result: 'unchanged' });
  for (const type of ['checkout.session.async_payment_failed', 'checkout.session.expired']) {
    const response = await deliver(base, checkoutSessionEvent(invoice, {
      id: `evt_${type}`, type, session: { payment_status: 'unpaid', status: 'expired' }
    }));
    assert.deepEqual(await response.json(), { received: true, result: 'unchanged' });
  }
  assert.equal((await detail(url, invoice.id)).status, 'unpaid');

  const succeeded = await deliver(base, checkoutSessionEvent(invoice, {
    id: 'evt_async_ok', type: 'checkout.session.async_payment_succeeded'
  }));
  assert.deepEqual(await succeeded.json(), { received: true, result: 'paid' });
  assert.equal((await detail(url, invoice.id)).status, 'paid');
  assert.equal(processedEvents(db).length, 4);
});

test('duplicate and later events keep the first paid state', async t => {
  const { base, db, url, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();
  const event = checkoutSessionEvent(invoice);

  await deliver(base, event);
  const first = await detail(url, invoice.id);
  const duplicate = await deliver(base, event);
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { received: true, result: 'duplicate' });

  const later = await deliver(base, checkoutSessionEvent(invoice, {
    id: 'evt_later', type: 'checkout.session.async_payment_succeeded', session: { id: 'cs_test_other' }
  }));
  assert.deepEqual(await later.json(), { received: true, result: 'already_paid' });
  const expired = await deliver(base, checkoutSessionEvent(invoice, {
    id: 'evt_expired_late', type: 'checkout.session.expired', session: { payment_status: 'unpaid' }
  }));
  assert.deepEqual(await expired.json(), { received: true, result: 'unchanged' });

  assert.deepEqual(await detail(url, invoice.id), first);
  const session = db.prepare('SELECT stripe_checkout_session_id AS id FROM invoices WHERE id = ?').get(invoice.id);
  assert.equal(session.id, 'cs_test_paid');
  assert.deepEqual(processedEvents(db).map(row => row.eventId), ['evt_expired_late', 'evt_later', 'evt_test_paid']);
});

test('a failed event record rolls back the payment so Stripe can retry', async t => {
  const { base, db, url, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();
  db.exec(`CREATE TRIGGER fail_event_record BEFORE INSERT ON processed_webhook_events
    BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END`);

  const failed = await deliver(base, checkoutSessionEvent(invoice));
  assert.equal(failed.status, 500);
  const body = await failed.text();
  assert.match(body, /INTERNAL_ERROR/);
  assert.doesNotMatch(body, /simulated/);
  const unchanged = await detail(url, invoice.id);
  assert.equal(unchanged.status, 'unpaid');
  assert.equal(unchanged.paidAt, null);
  assert.deepEqual(processedEvents(db), []);

  db.exec('DROP TRIGGER fail_event_record');
  const retried = await deliver(base, checkoutSessionEvent(invoice));
  assert.deepEqual(await retried.json(), { received: true, result: 'paid' });
  assert.equal((await detail(url, invoice.id)).status, 'paid');
});

test('unrelated event types are acknowledged and ignored', async t => {
  const { base, db, url, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();
  const event = { ...checkoutSessionEvent(invoice, { id: 'evt_pi' }), type: 'payment_intent.succeeded' };
  const response = await deliver(base, event);
  assert.deepEqual(await response.json(), { received: true, result: 'ignored' });
  assert.equal((await detail(url, invoice.id)).status, 'unpaid');
  assert.deepEqual(processedEvents(db), []);
});

test('webhooks are refused when no signing secret is configured', async t => {
  const { base, url, createInvoice } = await startPaymentApi(t, createStripeGateway({ STRIPE_SECRET_KEY: 'sk_test_unitsuite' }));
  const invoice = await createInvoice();
  const response = await deliver(base, checkoutSessionEvent(invoice));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'PAYMENTS_UNAVAILABLE');
  assert.equal((await detail(url, invoice.id)).status, 'unpaid');
});
