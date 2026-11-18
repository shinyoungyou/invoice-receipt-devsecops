import { randomUUID } from 'node:crypto';
import { validateInvoiceInput } from './validation.js';
import { calculateInvoiceTotals } from './totals.js';

export function createInvoice(db, body) {
  const input = validateInvoiceInput(body);
  const totals = calculateInvoiceTotals(input.items, input.taxRateBps);
  const id = randomUUID();
  const invoiceNumber = `INV-${id.toUpperCase()}`;
  const timestamp = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO invoices (
      id, invoice_number, seller_name, customer_name, currency,
      subtotal_cents, tax_rate_bps, tax_cents, total_cents, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, invoiceNumber, input.sellerName, input.customerName, input.currency,
      totals.subtotalCents, totals.taxRateBps, totals.taxCents, totals.totalCents, timestamp, timestamp
    );
    const addItem = db.prepare(`INSERT INTO invoice_items (
      invoice_id, description, quantity, unit_price_cents, line_total_cents
    ) VALUES (?, ?, ?, ?, ?)`);
    for (const item of totals.items) {
      addItem.run(id, item.description, item.quantity, item.unitPriceCents, item.lineTotalCents);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return {
    id, invoiceNumber, sellerName: input.sellerName, customerName: input.customerName,
    currency: input.currency, status: 'unpaid', ...totals,
    createdAt: timestamp, updatedAt: timestamp, paidAt: null, receiptUrl: null
  };
}
