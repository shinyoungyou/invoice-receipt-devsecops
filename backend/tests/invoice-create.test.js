import { test } from 'node:test';
import assert from 'node:assert/strict';
import { input, startInvoiceApi } from './support/invoice-api.js';

test('creating an invoice returns 201 and stores the calculated unpaid total', async t => {
  const { db, create } = await startInvoiceApi(t);
  const response = await create();
  assert.equal(response.status, 201);
  const invoice = await response.json();
  assert.equal(response.headers.get('location'), `/api/invoices/${invoice.id}`);
  assert.ok(invoice.invoiceNumber);
  assert.equal(invoice.createdAt, invoice.updatedAt);
  assert.equal(new Date(invoice.createdAt).toISOString(), invoice.createdAt);
  assert.deepEqual(invoice.items.map(item => item.lineTotalCents), [2598, 499]);
  assert.equal(invoice.subtotalCents, 3097);
  assert.equal(invoice.taxCents, 155);
  assert.equal(invoice.totalCents, 3252);
  assert.equal(invoice.currency, 'CAD');
  assert.equal(invoice.status, 'unpaid');
  assert.equal(invoice.paidAt, null);
  assert.equal(invoice.receiptUrl, null);
  assert.equal(db.prepare('SELECT total_cents FROM invoices WHERE id = ?').get(invoice.id).total_cents, 3252);
  assert.equal(db.prepare('SELECT count(*) AS n FROM invoice_items WHERE invoice_id = ?').get(invoice.id).n, 2);
});

test('create returns a field-specific validation error before writing', async t => {
  const { db, create } = await startInvoiceApi(t);
  const response = await create({ ...input, status: 'paid' });
  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).error, {
    code: 'INVALID_INVOICE', message: 'Unexpected field.', field: 'status'
  });
  assert.equal(db.prepare('SELECT count(*) AS n FROM invoices').get().n, 0);
});

test('an item insert failure rolls back the entire invoice and leaves the database usable', async t => {
  const { db, create } = await startInvoiceApi(t);
  db.exec(`CREATE TEMP TRIGGER simulate_failure BEFORE INSERT ON invoice_items
    WHEN NEW.description = 'Fries' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`);
  const response = await create();
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, 'INTERNAL_ERROR');
  assert.equal(db.prepare('SELECT count(*) AS n FROM invoices').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM invoice_items').get().n, 0);
  const zeroTotal = { ...input.items[0], unitPriceCents: 0 };
  const retry = await create({ ...input, items: [zeroTotal] });
  assert.equal(retry.status, 201);
  assert.equal((await retry.json()).totalCents, 0);
});
