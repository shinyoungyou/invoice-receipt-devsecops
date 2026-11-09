import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, initializeDatabase } from '../db/database.js';

function insertInvoice(db) {
  db.prepare(`INSERT INTO invoices
    (id, invoice_number, seller_name, customer_name, subtotal_cents,
     tax_rate_bps, tax_cents, total_cents, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('demo-1', 'INV-0001', 'Demo Donair', 'Demo Customer', 1000,
      500, 50, 1050, '2026-11-09T18:00:00Z', '2026-11-09T18:00:00Z');
}

test('bootstrap creates schema and repeated initialization preserves records', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  insertInvoice(db);
  initializeDatabase(db);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
  assert.equal(db.prepare('SELECT total_cents FROM invoices').get().total_cents, 1050);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM invoice_items').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM processed_webhook_events').get().count, 0);
});

test('SQLite enforces foreign keys and positive integer quantities', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const insert = db.prepare(`INSERT INTO invoice_items
    (invoice_id, description, quantity, unit_price_cents, line_total_cents)
    VALUES (?, ?, ?, ?, ?)`);
  assert.throws(() => insert.run('missing', 'Donair', 1, 1000, 1000),
    { code: 'ERR_SQLITE_ERROR', errcode: 787 });
  insertInvoice(db);
  assert.throws(() => insert.run('demo-1', 'Donair', 0, 1000, 0),
    { code: 'ERR_SQLITE_ERROR', errcode: 275 });
  insert.run('demo-1', 'Donair', 1, 1000, 1000);
});

test('file database persists after closing and reopening', () => {
  const folder = mkdtempSync(join(tmpdir(), 'invoice-db-test-'));
  let db;
  try {
    const path = join(folder, 'nested', 'test.db');
    db = openDatabase(path);
    insertInvoice(db);
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM invoices').get().count, 1);
  } finally {
    if (db?.isOpen) db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
