// Leaving the app for Stripe's hosted checkout page. Kept in its own module so
// tests can replace it (jsdom cannot navigate to another site).

const STRIPE_CHECKOUT_ORIGIN = 'https://checkout.stripe.com';

/**
 * Only Stripe's own checkout pages are allowed. If the server, or anything
 * between it and the browser, sent another URL, refuse it instead of becoming
 * an open redirect to a look-alike payment page.
 */
export function isStripeCheckoutUrl(url) {
  try {
    return new URL(url).origin === STRIPE_CHECKOUT_ORIGIN;
  } catch {
    return false;
  }
}

export function goToStripeCheckout(url) {
  window.location.assign(url);
}
