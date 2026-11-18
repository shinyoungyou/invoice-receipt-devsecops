import Stripe from 'stripe';

export class PaymentConfigError extends Error {}

// Only Stripe test-mode credentials are accepted for this demo project.
const testSecretKey = /^(sk|rk)_test_[A-Za-z0-9]+$/;

/**
 * Wraps the Stripe calls used by the payment routes. The app stores one gateway
 * as `app.locals.payments`; tests replace it with a mock that has the same shape.
 * Environment variables are read on first use so the server can start without them.
 */
export function createStripeGateway(env = process.env) {
  let client;

  function stripe() {
    if (client) return client;
    const key = env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new PaymentConfigError('STRIPE_SECRET_KEY is not configured.');
    if (!testSecretKey.test(key)) {
      throw new PaymentConfigError('STRIPE_SECRET_KEY must be a Stripe test-mode key.');
    }
    client = new Stripe(key, { maxNetworkRetries: 2, timeout: 10000 });
    return client;
  }

  return {
    createCheckoutSession(params, { idempotencyKey }) {
      return stripe().checkout.sessions.create(params, { idempotencyKey });
    },

    retrieveCheckoutSession(sessionId) {
      return stripe().checkout.sessions.retrieve(sessionId);
    },

    // Throws Stripe.errors.StripeSignatureVerificationError for a bad signature.
    verifyWebhook(rawBody, signature) {
      const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!secret) throw new PaymentConfigError('STRIPE_WEBHOOK_SECRET is not configured.');
      return Stripe.webhooks.constructEvent(rawBody, signature, secret);
    }
  };
}
