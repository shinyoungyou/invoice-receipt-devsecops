import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReceipt, formatCad, renderReceiptPdf } from '../payments/receipt.js';
import { getInvoice } from '../invoices/repository.js';
import { input } from './support/invoice-api.js';
import { checkoutSessionEvent, deliver, markPaid, startPaymentApi } from './support/payments.js';

const receipt = (base, id) => fetch(`${base}/invoices/${id}/receipt`);

test('receipts are refused for unknown and unpaid invoices', async t => {
  const { base, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();

  const missing = await receipt(base, 'missing');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'INVOICE_NOT_FOUND');

  const unpaid = await receipt(base, invoice.id);
  assert.equal(unpaid.status, 409);
  assert.equal((await unpaid.json()).error.code, 'INVOICE_NOT_PAID');
});

test('a verified payment makes a PDF receipt downloadable', async t => {
  const { base, url, createInvoice } = await startPaymentApi(t);
  const invoice = await createInvoice();
  await deliver(base, checkoutSessionEvent(invoice));
  const { receiptUrl } = await fetch(`${url}/${invoice.id}`).then(response => response.json());

  const response = await fetch(new URL(receiptUrl, base));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="receipt-${invoice.invoiceNumber}.pdf"`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const pdf = Buffer.from(await response.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.subarray(-6).toString(), /%%EOF/);
});

test('receipt content comes from the stored invoice, items and payment date', async t => {
  const { db, createInvoice } = await startPaymentApi(t);
  const created = await createInvoice();
  markPaid(db, created.id, '2026-11-14T15:00:00.000Z');
  const invoice = getInvoice(db, created.id);

  assert.deepEqual(buildReceipt(invoice), {
    title: 'Payment receipt',
    invoiceNumber: invoice.invoiceNumber,
    sellerName: 'Demo Donair',
    customerName: 'Guest',
    paidAt: 'November 14, 2026, 15:00 UTC',
    status: 'PAID',
    items: [
      { description: 'Donair', quantity: '2', unitPrice: '$12.99', lineTotal: '$25.98' },
      { description: 'Fries', quantity: '1', unitPrice: '$4.99', lineTotal: '$4.99' }
    ],
    subtotal: '$30.97',
    taxLabel: 'Tax (5%)',
    tax: '$1.55',
    total: '$32.52 CAD',
    note: 'Charged in CAD. Amounts are taken from the stored invoice.'
  });
  assert.throws(() => buildReceipt({ ...invoice, status: 'unpaid', paidAt: null }), /only for paid/);
});

test('long receipts continue onto additional pages', async t => {
  const { db, createInvoice } = await startPaymentApi(t);
  const items = Array.from({ length: 60 }, (_, index) => ({
    description: `Catering tray ${index + 1} ${'with extra garlic sauce '.repeat(4)}`, quantity: 1, unitPriceCents: 1000
  }));
  const created = await createInvoice({ ...input, items });
  markPaid(db, created.id);
  const pdf = await renderReceiptPdf(getInvoice(db, created.id));
  const pages = pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? [];
  assert.ok(pages.length > 1, `expected several pages, got ${pages.length}`);
});

test('CAD formatting uses exact integer cents', () => {
  assert.equal(formatCad(0), '$0.00');
  assert.equal(formatCad(5), '$0.05');
  assert.equal(formatCad(2728), '$27.28');
  assert.equal(formatCad(123456789), '$1,234,567.89');
  assert.equal(formatCad(Number.MAX_SAFE_INTEGER), '$90,071,992,547,409.91');
  assert.throws(() => formatCad(-1), RangeError);
  assert.throws(() => formatCad(1.5), RangeError);
});
