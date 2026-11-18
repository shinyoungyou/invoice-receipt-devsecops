import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateInvoiceInput } from '../invoices/validation.js';
import { calculateInvoiceTotals } from '../invoices/totals.js';

const item = { description: ' Donair ', quantity: 1, unitPriceCents: 10 };
const invoice = { sellerName: ' Shop ', customerName: ' Guest ', items: [item], taxRateBps: 500 };

test('validation normalizes a copy and defaults to CAD', () => {
  const clean = validateInvoiceInput(invoice);
  assert.equal(clean.currency, 'CAD');
  assert.equal(clean.sellerName, 'Shop');
  assert.equal(clean.customerName, 'Guest');
  assert.equal(clean.items[0].description, 'Donair');
  assert.equal(item.description, ' Donair ');
  assert.notEqual(clean.items[0], item);
});

test('invalid invoice fields and server-owned fields identify the offending input', () => {
  for (const [changes, field] of [
    [{ sellerName: '  ' }, 'sellerName'], [{ customerName: 'a'.repeat(201) }, 'customerName'],
    [{ currency: null }, 'currency'], [{ currency: 'USD' }, 'currency'], [{ status: 'paid' }, 'status'],
    [{ totalCents: 0 }, 'totalCents'], [{ id: 'demo' }, 'id'], [{ taxRateBps: '500' }, 'taxRateBps'],
    [{ items: [] }, 'items'], [{ items: Array(101).fill(item) }, 'items'],
    [{ items: [null] }, 'items[0]'], [{ items: [{ ...item, lineTotalCents: 4 }] }, 'items[0].lineTotalCents'],
    [{ items: [{ ...item, description: 'a'.repeat(501) }] }, 'items[0].description'],
    [{ items: [{ ...item, quantity: 0 }] }, 'items[0].quantity'],
    [{ items: [{ ...item, quantity: 1_000_001 }] }, 'items[0].quantity'],
    [{ items: [{ ...item, unitPriceCents: -1 }] }, 'items[0].unitPriceCents']
  ]) {
    assert.throws(() => validateInvoiceInput({ ...invoice, ...changes }), { field, code: 'INVALID_INVOICE', statusCode: 400 });
  }
  for (const input of [null, [], 'invoice', undefined]) {
    assert.throws(() => validateInvoiceInput(input), { field: 'invoice' });
  }
});

test('tax rounds half up once on the subtotal and item inputs keep their original fields', () => {
  const totals = calculateInvoiceTotals([item, item], 500);
  assert.equal(totals.subtotalCents, 20);
  assert.equal(totals.taxCents, 1);
  assert.equal(totals.totalCents, 21);
  assert.equal(totals.items[0].lineTotalCents, 10);
  assert.equal(item.lineTotalCents, undefined);
  for (const [price, rate, expected] of [[9, 500, 0], [10, 500, 1], [19, 0, 0], [0, 500, 0]]) {
    assert.equal(calculateInvoiceTotals([{ ...item, unitPriceCents: price }], rate).taxCents, expected);
  }
});

test('standalone totals validate inputs and reject line, subtotal and final overflow', () => {
  const maximum = { ...item, unitPriceCents: Number.MAX_SAFE_INTEGER };
  assert.equal(calculateInvoiceTotals([maximum], 0).totalCents, Number.MAX_SAFE_INTEGER);
  for (const [items, rate, field] of [
    [[{ ...item, quantity: '1' }], 0, 'items[0].quantity'],
    [[{ ...item, unitPriceCents: 1.1 }], 0, 'items[0].unitPriceCents'],
    [[item], 501, 'taxRateBps'],
    [[{ ...maximum, quantity: 2 }], 0, 'items[0].lineTotalCents'],
    [[maximum, item], 0, 'subtotalCents'], [[maximum], 500, 'totalCents']
  ]) {
    assert.throws(() => calculateInvoiceTotals(items, rate), { field });
  }
});
