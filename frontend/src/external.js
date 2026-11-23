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
  globalThis.location.assign(url);
}

// Saves a downloaded file (the PDF receipt) through a temporary link.
export function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
