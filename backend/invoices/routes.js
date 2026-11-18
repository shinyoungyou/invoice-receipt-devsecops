import { Router } from 'express';
import { createInvoice, getInvoice, listInvoices } from './repository.js';

const router = Router();

router.post('/', (req, res) => {
  const invoice = createInvoice(req.app.locals.db, req.body);
  res.location(`/api/invoices/${invoice.id}`).status(201).json(invoice);
});

function pageInteger(text, fallback) {
  if (text === undefined) return fallback;
  if (typeof text !== 'string' || !/^\d+$/.test(text)) return NaN;
  return Number(text);
}

router.get('/', (req, res) => {
  const { q = '', limit, offset } = req.query;
  const size = pageInteger(limit, 50);
  const start = pageInteger(offset, 0);
  const unknownKey = Object.keys(req.query).some(key => !['q', 'limit', 'offset'].includes(key));
  if (unknownKey || typeof q !== 'string' || !Number.isSafeInteger(size) || size < 1 ||
      size > 100 || !Number.isSafeInteger(start)) {
    return res.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Invalid invoice list parameters.' } });
  }
  res.json(listInvoices(req.app.locals.db, { q: q.trim(), limit: size, offset: start }));
});

router.param('id', (req, res, next, id) => {
  const invoice = getInvoice(req.app.locals.db, id);
  if (!invoice) {
    return res.status(404).json({ error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' } });
  }
  res.locals.invoice = invoice;
  next();
});

router.get('/:id', (_req, res) => res.json(res.locals.invoice));

export default router;
