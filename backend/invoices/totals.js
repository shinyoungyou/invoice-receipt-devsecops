import { InvoiceValidationError, validateItems, validateTaxRate } from './validation.js';

function safeCents(amount, field) {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InvoiceValidationError(field, 'Calculated amount exceeds the safe integer range.');
  }
  return Number(amount);
}

export function calculateInvoiceTotals(items, taxRateBps) {
  validateTaxRate(taxRateBps);
  let subtotal = 0n;
  const lines = validateItems(items).map((item, index) => {
    const amount = BigInt(item.quantity) * BigInt(item.unitPriceCents);
    const lineTotalCents = safeCents(amount, `items[${index}].lineTotalCents`);
    subtotal += amount;
    return { ...item, lineTotalCents };
  });
  const tax = (subtotal * BigInt(taxRateBps) + 5000n) / 10000n;
  return {
    items: lines,
    subtotalCents: safeCents(subtotal, 'subtotalCents'),
    taxRateBps,
    taxCents: Number(tax),
    totalCents: safeCents(subtotal + tax, 'totalCents')
  };
}
