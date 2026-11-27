import express from 'express';
import invoiceRoutes from './invoices/routes.js';
import { InvoiceValidationError } from './invoices/validation.js';
import { createUsdRateProvider } from './exchange-rates/usd.js';
import { paymentRoutes, stripeWebhookRoutes } from './payments/routes.js';
import { createStripeGateway } from './payments/stripe-gateway.js';
import { frontendRoutes } from './frontend-static.js';

const app = express();
app.locals.latestUsdRate = createUsdRateProvider();
app.locals.payments = createStripeGateway();
app.disable('x-powered-by');

// The Stripe webhook parses its own raw body and must stay BEFORE express.json().
// Signature verification requires the original request bytes.
app.use('/api/webhooks/stripe', stripeWebhookRoutes);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'invoice-receipt-backend' });
});

app.use('/api/invoices', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);

// The built frontend, when present (production). API paths are never served from it.
app.use(frontendRoutes());

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
