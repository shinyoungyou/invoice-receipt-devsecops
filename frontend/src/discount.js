// DEMO ONLY: lives on the demo/sonar-gate branch and is never merged.
//
// A deliberately weak helper for the SonarQube quality gate demo:
// - it has NO tests, so coverage on new code drops below the gate's 80%;
// - it does money math with floating-point dollars instead of integer cents,
//   the exact mistake the real code avoids (see src/money.js).

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

// Float math: 1.15 * 100 is 114.99999999999999, so Math.floor loses a cent.
export function applyDiscount(totalCents, code) {
  const dollars = totalCents / 100;
  const percent = discountPercent(code);
  const discounted = dollars - dollars * (percent / 100);
  return Math.floor(discounted * 100);
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
