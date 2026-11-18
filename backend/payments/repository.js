// Payment state changes for the shared invoices table. Member 2's repository
// owns invoice creation and reads; this module owns the transition to paid.

export const handledEventTypes = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired'
]);

const paymentEventTypes = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded'
]);

export function getCheckoutSessionId(db, invoiceId) {
  const row = db.prepare('SELECT stripe_checkout_session_id AS sessionId FROM invoices WHERE id = ?')
    .get(invoiceId);
  return row?.sessionId ?? null;
}

/** Remembers the latest Checkout Session. Returns false if the invoice is no longer unpaid. */
export function saveCheckoutSession(db, invoiceId, sessionId, now = new Date().toISOString()) {
  const result = db.prepare(`UPDATE invoices SET stripe_checkout_session_id = ?, updated_at = ?
    WHERE id = ? AND status = 'unpaid'`).run(sessionId, now, invoiceId);
  return result.changes === 1;
}

/**
 * Applies a signature-verified Stripe event. The invoice update and the
 * processed-event record are written in one transaction, so a repeated
 * delivery of the same event ID never repeats a payment side effect.
 *
 * Returns { httpStatus, code, result } describing the outcome. Unexpected
 * database errors roll back and are rethrown so Stripe retries the delivery.
 */
export function applyStripeEvent(db, event, now = new Date().toISOString()) {
  if (!handledEventTypes.has(event?.type)) {
    return { httpStatus: 200, result: 'ignored' };
  }
  const session = event.data?.object;
  const invoiceId = session?.client_reference_id;
  const metadataId = session?.metadata?.invoiceId;
  if (typeof event.id !== 'string' || typeof invoiceId !== 'string' ||
      (metadataId !== undefined && metadataId !== invoiceId)) {
    return { httpStatus: 400, code: 'INVALID_EVENT', result: 'rejected' };
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const seen = db.prepare('SELECT 1 FROM processed_webhook_events WHERE event_id = ?').get(event.id);
    if (seen) {
      db.exec('COMMIT');
      return { httpStatus: 200, result: 'duplicate' };
    }

    const invoice = db.prepare(`SELECT id, status, currency, total_cents AS totalCents
      FROM invoices WHERE id = ?`).get(invoiceId);
    if (!invoice) {
      db.exec('ROLLBACK');
      return { httpStatus: 404, code: 'INVOICE_NOT_FOUND', result: 'rejected' };
    }

    let result = 'unchanged';
    if (paymentEventTypes.has(event.type) && session.payment_status === 'paid') {
      if (session.mode !== 'payment' || session.currency !== invoice.currency.toLowerCase() ||
          session.amount_total !== invoice.totalCents) {
        db.exec('ROLLBACK');
        return { httpStatus: 422, code: 'PAYMENT_MISMATCH', result: 'rejected' };
      }
      // Only an unpaid invoice changes; a later event keeps the original paid state.
      const update = db.prepare(`UPDATE invoices
        SET status = 'paid', paid_at = ?, updated_at = ?, stripe_checkout_session_id = ?
        WHERE id = ? AND status = 'unpaid'`).run(now, now, session.id, invoiceId);
      result = update.changes === 1 ? 'paid' : 'already_paid';
    }

    db.prepare(`INSERT INTO processed_webhook_events (event_id, invoice_id, event_type, processed_at)
      VALUES (?, ?, ?, ?)`).run(event.id, invoiceId, event.type, now);
    db.exec('COMMIT');
    return { httpStatus: 200, result };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
