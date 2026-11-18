import { once } from 'node:events';
import { openDatabase } from '../../db/database.js';
import app from '../../app.js';

export const input = {
  sellerName: 'Demo Donair', customerName: 'Guest', taxRateBps: 500,
  items: [
    { description: 'Donair', quantity: 2, unitPriceCents: 1299 },
    { description: 'Fries', quantity: 1, unitPriceCents: 499 }
  ]
};

export async function startInvoiceApi(t) {
  const db = openDatabase(':memory:');
  app.locals.db = db;
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  });
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/invoices`;
  const create = (body = input) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return { db, url, create };
}
