import assert from 'node:assert/strict';
import { test } from 'node:test';
import { input, startInvoiceApi } from './support/invoice-api.js';

test('detail preserves item order and reflects the payment state in shared SQLite records', async t => {
  const { db, url, create } = await startInvoiceApi(t);
  const invoice = await (await create()).json();
  const detail = () => fetch(`${url}/${invoice.id}`).then(response => response.json());
  assert.deepEqual(await detail(), invoice);
  const paidAt = '2026-11-14T15:00:00.000Z';
  db.prepare("UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?")
    .run(paidAt, paidAt, invoice.id);
  assert.deepEqual(await detail(), {
    ...invoice, status: 'paid', paidAt, updatedAt: paidAt, receiptUrl: `/api/invoices/${invoice.id}/receipt`
  });
  const missing = await fetch(`${url}/missing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'INVOICE_NOT_FOUND');
});

test('search matches literal text in names and invoice number and returns ordered pages', async t => {
  const { create, db, url } = await startInvoiceApi(t);
  const list = (query = '') => fetch(url + query).then(response => response.json());
  assert.deepEqual(await list(), []);
  const first = await (await create({ ...input, customerName: 'Sam_100%' })).json();
  const second = await (await create({ ...input, sellerName: 'Cafe' })).json();
  db.prepare("UPDATE invoices SET created_at = '2026-10-01' WHERE id = ?").run(first.id);
  db.prepare("UPDATE invoices SET created_at = '2026-10-02' WHERE id = ?").run(second.id);
  assert.deepEqual((await list()).map(row => row.id), [second.id, first.id]);
  const [page] = await list('?limit=1&offset=1');
  assert.equal(page.id, first.id);
  assert.equal(page.items, undefined);
  assert.equal(page.receiptUrl, null);
  for (const term of [' sam_ ', '100%', first.invoiceNumber.toLowerCase(), 'donair']) {
    const rows = await list('?q=' + encodeURIComponent(term));
    assert.deepEqual(rows.map(row => row.id), [first.id]);
  }
  assert.deepEqual(await list('?q=unknown'), []);
});

test('list rejects unsupported, repeated and out-of-range query parameters', async t => {
  const { url } = await startInvoiceApi(t);
  for (const query of ['limit=0', 'limit=101', 'limit=2.1', 'offset=-1', 'offset=1e3',
    'offset=9007199254740992', 'q=a&q=b', 'limit=1&limit=2', 'sort=unknown']) {
    const response = await fetch(`${url}?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error.code, 'INVALID_QUERY');
  }
});
