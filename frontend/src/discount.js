// DEMO ONLY: lives on the demo/sonar-gate branch and is never merged.
//
// Discount helper for the SonarQube quality gate demo. The first version had
// no tests and did money math in floating-point dollars, which lost a cent
// (115 cents came back as 114). It now works in integer cents, like
// src/money.js, and is covered by tests/discount.test.js.

const DISCOUNT_CODES = {
  STUDENT10: 10,
  STAFF15: 15,
  WELCOME5: 5
};

export function discountPercent(code) {
  if (typeof code !== 'string') return 0;
  const percent = DISCOUNT_CODES[code.trim().toUpperCase()];
  return percent ?? 0;
}

// Integer cents only. The discount is rounded half up to the nearest cent:
// totalCents * percent is an integer, so (x + 50) / 100 floored is exact.
export function applyDiscount(totalCents, code) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new TypeError(`Expected nonnegative integer cents, got ${totalCents}`);
  }
  const percent = discountPercent(code);
  const discountCents = Math.floor((totalCents * percent + 50) / 100);
  return totalCents - discountCents;
}

export function describeDiscount(totalCents, code) {
  const percent = discountPercent(code);
  if (percent === 0) return 'No discount applied.';
  const saved = totalCents - applyDiscount(totalCents, code);
  return `${code.trim().toUpperCase()}: ${percent}% off, you save ${saved} cents.`;
}

export function isValidDiscountCode(code) {
  return discountPercent(code) > 0;
}
