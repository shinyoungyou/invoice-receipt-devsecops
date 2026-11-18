import express, { Router } from 'express';
import Stripe from 'stripe';
import { getInvoice } from '../invoices/repository.js';
import { applyStripeEvent, getCheckoutSessionId, saveCheckoutSession } from './repository.js';
import { PaymentConfigError } from './stripe-gateway.js';
import { renderReceiptPdf } from './receipt.js';

// Stripe's limits for a single CAD charge.
export const MIN_CHECKOUT_CENTS = 50;
export const MAX_CHECKOUT_CENTS = 99_999_999;

const defaultReturnUrls = {
  success: 'http://localhost:5173/invoices/{INVOICE_ID}?checkout=success',
  cancel: 'http://localhost:5173/invoices/{INVOICE_ID}?checkout=cancelled'
};

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

/** Expands a return URL template. Exported for tests. */
export function returnUrl(template, invoiceId) {
  let url;
  try {
    url = new URL(template.replaceAll('{INVOICE_ID}', encodeURIComponent(invoiceId)));
  } catch {
    throw new PaymentConfigError('Checkout return URLs must be absolute URLs.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new PaymentConfigError('Checkout return URLs must use http or https.');
  // Stripe substitutes {CHECKOUT_SESSION_ID} itself; keep the braces unescaped.
  return url.href.replaceAll('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}');
}

function checkoutParams(invoice, env = process.env) {
  const metadata = { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
  const itemCount = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    mode: 'payment',
    client_reference_id: invoice.id,
    metadata,
    payment_intent_data: { metadata, description: `Invoice ${invoice.invoiceNumber}` },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: invoice.currency.toLowerCase(),
        unit_amount: invoice.totalCents,
        product_data: {
          name: `Invoice ${invoice.invoiceNumber}`,
          description: `${invoice.sellerName}: ${itemCount} item(s), tax included`
        }
      }
    }],
    success_url: returnUrl(env.CHECKOUT_SUCCESS_URL || defaultReturnUrls.success, invoice.id),
    cancel_url: returnUrl(env.CHECKOUT_CANCEL_URL || defaultReturnUrls.cancel, invoice.id)
  };
}

function matchesInvoice(session, invoice) {
  return session.client_reference_id === invoice.id &&
    session.currency === invoice.currency.toLowerCase() &&
    session.amount_total === invoice.totalCents;
}

function checkoutResponse(invoice, session) {
  return {
    invoiceId: invoice.id,
    status: invoice.status,
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    currency: invoice.currency,
    amountCents: invoice.totalCents,
    expiresAt: Number.isInteger(session.expires_at) ? new Date(session.expires_at * 1000).toISOString() : null
  };
}

function providerFailure(res, error) {
  if (error instanceof PaymentConfigError) {
    return sendError(res, 503, 'PAYMENTS_UNAVAILABLE', 'Payments are not configured on this server.');
  }
  return sendError(res, 502, 'PAYMENT_PROVIDER_ERROR', 'The payment provider could not start checkout.');
}

export const paymentRoutes = Router();

paymentRoutes.post('/:id/checkout', async (req, res) => {
  const { db, payments } = req.app.locals;
  const invoice = getInvoice(db, req.params.id);
  if (!invoice) return sendError(res, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  if (invoice.status === 'paid') return sendError(res, 409, 'INVOICE_ALREADY_PAID', 'Invoice is already paid.');
  if (invoice.totalCents < MIN_CHECKOUT_CENTS || invoice.totalCents > MAX_CHECKOUT_CENTS) {
    return sendError(res, 422, 'CHECKOUT_AMOUNT_UNSUPPORTED',
      'Card checkout requires a total from $0.50 to $999,999.99 CAD.');
  }

  try {
    const previousId = getCheckoutSessionId(db, invoice.id);
    if (previousId) {
      const previous = await payments.retrieveCheckoutSession(previousId);
      if (previous.status === 'complete' && matchesInvoice(previous, invoice)) {
        // Paid in Stripe but the verified webhook has not arrived yet. Do not
        // open a second session that could charge the customer twice.
        return sendError(res, 409, 'PAYMENT_PENDING', 'Payment is being confirmed. Refresh the invoice shortly.');
      }
      if (previous.status === 'open' && matchesInvoice(previous, invoice) && previous.url) {
        return res.json(checkoutResponse(invoice, previous));
      }
    }
    // The key makes concurrent first requests share one Stripe session.
    const session = await payments.createCheckoutSession(checkoutParams(invoice), {
      idempotencyKey: `checkout:${invoice.id}:${previousId ?? 'initial'}`
    });
    if (!saveCheckoutSession(db, invoice.id, session.id)) {
      return sendError(res, 409, 'INVOICE_ALREADY_PAID', 'Invoice is already paid.');
    }
    return res.status(201).json(checkoutResponse(invoice, session));
  } catch (error) {
    return providerFailure(res, error);
  }
});

paymentRoutes.get('/:id/receipt', async (req, res) => {
  const invoice = getInvoice(req.app.locals.db, req.params.id);
  if (!invoice) return sendError(res, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  if (invoice.status !== 'paid') return sendError(res, 409, 'INVOICE_NOT_PAID', 'A receipt is available after payment is confirmed.');
  const pdf = await renderReceiptPdf(invoice);
  const filename = `receipt-${invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  return res.send(pdf);
});

// Mounted BEFORE express.json(): signature verification needs the exact bytes Stripe sent.
export const stripeWebhookRoutes = Router();

stripeWebhookRoutes.post('/', express.raw({ type: 'application/json', limit: '256kb' }), (req, res) => {
  const { db, payments } = req.app.locals;
  const signature = req.get('stripe-signature');
  if (!Buffer.isBuffer(req.body) || !signature) {
    return sendError(res, 400, 'INVALID_SIGNATURE', 'Missing Stripe signature or JSON body.');
  }
  let event;
  try {
    event = payments.verifyWebhook(req.body, signature);
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return sendError(res, 503, 'PAYMENTS_UNAVAILABLE', 'Webhook verification is not configured.');
    }
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return sendError(res, 400, 'INVALID_SIGNATURE', 'Stripe signature verification failed.');
    }
    throw error;
  }

  const outcome = applyStripeEvent(db, event);
  if (outcome.code) {
    const messages = {
      INVALID_EVENT: 'Event does not identify an invoice consistently.',
      INVOICE_NOT_FOUND: 'Event refers to an unknown invoice.',
      PAYMENT_MISMATCH: 'Paid amount, currency or mode does not match the invoice.'
    };
    return sendError(res, outcome.httpStatus, outcome.code, messages[outcome.code]);
  }
  return res.status(outcome.httpStatus).json({ received: true, result: outcome.result });
});
