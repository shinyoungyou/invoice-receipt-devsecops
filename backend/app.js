import express from 'express';
import invoiceRoutes from './invoices/routes.js';
import { InvoiceValidationError } from './invoices/validation.js';

const app = express();
app.disable('x-powered-by');

// Mount the future Stripe webhook with express.raw() BEFORE this parser.
// Signature verification requires the original request bytes.
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'invoice-receipt-backend' });
});

app.use('/api/invoices', invoiceRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

// Four parameters are required for Express to recognize an error handler.
app.use((err, _req, res, _next) => {
  if (err instanceof InvoiceValidationError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, field: err.field }
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' }
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'BODY_TOO_LARGE', message: 'Request body exceeds the size limit.' }
    });
  }
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }
  });
});

export default app;
