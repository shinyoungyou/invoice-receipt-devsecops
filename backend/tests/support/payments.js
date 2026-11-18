import Stripe from 'stripe';
import app from '../../app.js';
import { createStripeGateway } from '../../payments/stripe-gateway.js';
import { startInvoiceApi } from './invoice-api.js';

// Synthetic test-mode values. No request reaches Stripe in the unit suite.
export const webhookSecret = 'whsec_unit_test_secret';
export const testGatewayEnv = { STRIPE_SECRET_KEY: 'sk_test_unitsuite', STRIPE_WEBHOOK_SECRET: webhookSecret };

/** Starts the shared API with an isolated database and the given payment gateway. */
export async function startPaymentApi(t, payments = createStripeGateway(testGatewayEnv)) {
  const api = await startInvoiceApi(t);
  const original = app.locals.payments;
  app.locals.payments = payments;
  t.after(() => { app.locals.payments = original; });
  const base = api.url.replace(/\/invoices$/, '');
  const createInvoice = async body => (await api.create(body)).json();
  return { ...api, base, createInvoice };
}

export function checkoutSessionEvent(invoice, { type = 'checkout.session.completed', id = 'evt_test_paid', session = {} } = {}) {
  return {
    id,
    object: 'event',
    type,
    created: 1795000000,
    data: {
      object: {
        id: 'cs_test_paid',
        object: 'checkout.session',
        mode: 'payment',
        status: 'complete',
        payment_status: 'paid',
        client_reference_id: invoice.id,
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
        currency: 'cad',
        amount_total: invoice.totalCents,
        ...session
      }
    }
  };
}

export function signedHeader(payload, secret = webhookSecret) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

export function postWebhook(base, payload, headers) {
  return fetch(`${base}/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: payload
  });
}

export function deliver(base, event, secret = webhookSecret) {
  const payload = JSON.stringify(event);
  return postWebhook(base, payload, { 'Stripe-Signature': signedHeader(payload, secret) });
}

export function processedEvents(db) {
  return db.prepare('SELECT event_id AS eventId, invoice_id AS invoiceId, event_type AS eventType FROM processed_webhook_events ORDER BY event_id').all();
}

export function markPaid(db, invoiceId, paidAt = '2026-11-14T15:00:00.000Z') {
  db.prepare("UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?").run(paidAt, paidAt, invoiceId);
}
