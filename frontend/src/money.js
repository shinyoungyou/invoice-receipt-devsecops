// Money helpers. Amounts are integer cents everywhere; these functions never
// do floating-point arithmetic on money (e.g. 1.15 * 100 === 114.99999999999999).

const CURRENCY_PREFIX = { CAD: '$', USD: 'US$' };

// Accepts "12", "12.5" or "12.50" (an optional leading "$" and surrounding
// spaces are allowed). Rejects negatives, commas, exponents and more than two
// decimal places.
const PRICE_PATTERN = /^\$?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Converts a typed price such as "12.99" to integer cents (1299).
 * Returns null when the text is not a valid nonnegative price.
 * The conversion splits the string at the decimal point instead of
 * multiplying a float by 100.
 */
export function parsePriceToCents(text) {
  if (typeof text !== 'string') return null;
  const match = PRICE_PATTERN.exec(text.trim());
  if (!match) return null;

  const [, dollars, fraction = ''] = match;
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Formats integer cents for display, e.g. formatMoney(272800) === "$2,728.00"
 * and formatMoney(1904, 'USD') === "US$19.04".
 */
export function formatMoney(cents, currency = 'CAD') {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`Expected integer cents, got ${cents}`);
  }
  const prefix = CURRENCY_PREFIX[currency];
  if (prefix === undefined) {
    throw new RangeError(`Unsupported currency ${currency}`);
  }

  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100).toLocaleString('en-CA');
  const remainder = String(absolute % 100).padStart(2, '0');
  return `${sign}${prefix}${dollars}.${remainder}`;
}

/** Formats a tax rate in basis points, e.g. 500 -> "5%" and 0 -> "0%". */
export function formatTaxRate(bps) {
  return `${bps / 100}%`;
}
