import { Router } from 'express';
import { createInvoice } from './repository.js';

const router = Router();

router.post('/', (req, res) => {
  const invoice = createInvoice(req.app.locals.db, req.body);
  res.location(`/api/invoices/${invoice.id}`).status(201).json(invoice);
});

export default router;
