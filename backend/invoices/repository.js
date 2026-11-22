import { randomUUID } from 'node:crypto';
import { validateInvoiceInput } from './validation.js';
import { calculateInvoiceTotals } from './totals.js';

const summaryColumns = `id, invoice_number AS invoiceNumber, seller_name AS sellerName,
  customer_name AS customerName, currency, status, subtotal_cents AS subtotalCents,
  tax_rate_bps AS taxRateBps, tax_cents AS taxCents, total_cents AS totalCents,
  created_at AS createdAt, updated_at AS updatedAt, paid_at AS paidAt`;

function withReceiptUrl(row) {
  const receiptUrl = row.status === 'paid' ? `/api/invoices/${encodeURIComponent(row.id)}/receipt` : null;
  return { ...row, receiptUrl };
}

export function getInvoice(db, id) {
  const row = db.prepare(`SELECT ${summaryColumns} FROM invoices WHERE id = ?`).get(id);
  if (!row) return null;
  const items = db.prepare(`SELECT description, quantity, unit_price_cents AS unitPriceCents,
    line_total_cents AS lineTotalCents FROM invoice_items WHERE invoice_id = ? ORDER BY id`).all(id);
  return { ...withReceiptUrl(row), items };
}

export function listInvoices(db, { q, limit, offset }) {
  const rows = db.prepare(`SELECT ${summaryColumns} FROM invoices
    WHERE instr(lower(invoice_number), lower(?)) > 0 OR instr(lower(seller_name), lower(?)) > 0
       OR instr(lower(customer_name), lower(?)) > 0
    ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`).all(q, q, q, limit, offset);
  return rows.map(withReceiptUrl);
}

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
