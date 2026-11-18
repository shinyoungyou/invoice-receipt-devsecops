export class InvoiceValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'InvoiceValidationError';
    this.code = 'INVALID_INVOICE';
    this.statusCode = 400;
    this.field = field;
  }
}

function checkFields(value, field, allowed) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvoiceValidationError(field, 'Expected an object.');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new InvoiceValidationError(field === 'invoice' ? key : `${field}.${key}`, 'Unexpected field.');
    }
  }
}

function trimmedText(value, field, maximum) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maximum) {
    throw new InvoiceValidationError(field, `Expected 1 to ${maximum} trimmed characters.`);
  }
  return text;
}

function integerInRange(value, field, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new InvoiceValidationError(field, `Expected an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function validateTaxRate(rate) {
  if (rate !== 0 && rate !== 500) {
    throw new InvoiceValidationError('taxRateBps', 'Supported demo tax rates are 0 and 500 basis points.');
  }
  return rate;
}

export function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new InvoiceValidationError('items', 'Expected 1 to 100 invoice items.');
  }
  return Array.from(items, (item, index) => {
    const field = `items[${index}]`;
    checkFields(item, field, ['description', 'quantity', 'unitPriceCents']);
    return {
      description: trimmedText(item.description, `${field}.description`, 500),
      quantity: integerInRange(item.quantity, `${field}.quantity`, 1, 1_000_000),
      unitPriceCents: integerInRange(item.unitPriceCents, `${field}.unitPriceCents`, 0, Number.MAX_SAFE_INTEGER)
    };
  });
}

export function validateInvoiceInput(value) {
  checkFields(value, 'invoice', ['sellerName', 'customerName', 'currency', 'taxRateBps', 'items']);
  if (value.currency !== undefined && value.currency !== 'CAD') {
    throw new InvoiceValidationError('currency', 'Invoices must use CAD.');
  }
  return {
    sellerName: trimmedText(value.sellerName, 'sellerName', 200),
    customerName: trimmedText(value.customerName, 'customerName', 200),
    currency: 'CAD',
    taxRateBps: validateTaxRate(value.taxRateBps),
    items: validateItems(value.items)
  };
}
