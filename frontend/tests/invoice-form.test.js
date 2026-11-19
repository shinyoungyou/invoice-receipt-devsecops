import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderInvoiceForm } from '../src/views/invoice-form.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

let container;
let form;
let onCreated;
let fetchMock;

const input = name => form.querySelector(`[data-field="${name}"]`);
const errorFor = name => document.getElementById(input(name).getAttribute('aria-describedby'));
const submitButton = () => form.querySelector('button[type="submit"]');
const formError = () => form.querySelector('.form-error');
const itemRows = () => form.querySelectorAll('.item-row');

function type(name, value) {
  const field = input(name);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function fillValidInvoice() {
  type('sellerName', '  Demo Donair Shop ');
  type('customerName', 'Demo Customer');
  type('items[0].description', ' Chicken donair ');
  type('items[0].quantity', '2');
  type('items[0].unitPriceCents', '12.99');
}

function submit() {
  submitButton().click();
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  container = document.createElement('div');
  document.body.append(container);
  onCreated = vi.fn();
  form = renderInvoiceForm(container, { onCreated });
});

afterEach(() => {
  container.remove();
  vi.unstubAllGlobals();
});

describe('initial state', () => {
  test('starts with one labelled item that cannot be removed', () => {
    expect(itemRows()).toHaveLength(1);
    expect(itemRows()[0].querySelector('legend').textContent).toBe('Item 1');
    expect(itemRows()[0].querySelector('.remove-item').disabled).toBe(true);
    expect(input('taxRateBps').value).toBe('500');
  });

  test('every input has a label', () => {
    for (const field of form.querySelectorAll('input, select')) {
      expect(form.querySelector(`label[for="${field.id}"]`)?.textContent).toBeTruthy();
    }
  });
});

describe('items', () => {
  test('adding and removing items renumbers labels and field names', () => {
    form.querySelector('.add-item').click();
    form.querySelector('.add-item').click();
    expect(itemRows()).toHaveLength(3);
    type('items[2].description', 'Third');

    itemRows()[0].querySelector('.remove-item').click();

    expect(itemRows()).toHaveLength(2);
    expect([...itemRows()].map(row => row.querySelector('legend').textContent)).toEqual(['Item 1', 'Item 2']);
    expect(input('items[1].description').value).toBe('Third');
    expect(input('items[2].description')).toBeNull();
  });

  test('the remove button returns when there is more than one item', () => {
    form.querySelector('.add-item').click();
    for (const row of itemRows()) {
      expect(row.querySelector('.remove-item').disabled).toBe(false);
    }
  });

  test('stops adding items at the backend limit of 100', () => {
    const addItem = form.querySelector('.add-item');
    for (let i = 1; i < 100; i += 1) addItem.click();

    expect(itemRows()).toHaveLength(100);
    expect(addItem.disabled).toBe(true);
  });
});

describe('valid submission', () => {
  test('sends trimmed names, integer cents and the tax rate, then reports the created invoice', async () => {
    const created = { id: 'inv_1', invoiceNumber: 'INV-0001', totalCents: 2728, status: 'unpaid' };
    fetchMock.mockResolvedValue(jsonResponse(201, created));
    fillValidInvoice();

    submit();

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/invoices');
    expect(JSON.parse(init.body)).toEqual({
      sellerName: 'Demo Donair Shop',
      customerName: 'Demo Customer',
      taxRateBps: 500,
      items: [{ description: 'Chicken donair', quantity: 2, unitPriceCents: 1299 }]
    });
  });

  test('a $1.15 price is sent as exactly 115 cents', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, {}));
    fillValidInvoice();
    type('items[0].unitPriceCents', '1.15');
    input('taxRateBps').value = '0';

    submit();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items[0].unitPriceCents).toBe(115);
    expect(body.taxRateBps).toBe(0);
  });

  test('never sends a client-calculated total', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, {}));
    fillValidInvoice();

    submit();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body).sort()).toEqual(['customerName', 'items', 'sellerName', 'taxRateBps']);
  });

  test('disables the button while the request is in flight', async () => {
    let respond;
    fetchMock.mockReturnValue(new Promise(resolve => { respond = resolve; }));
    fillValidInvoice();

    submit();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toBe('Creating…');

    respond(jsonResponse(201, {}));
    await vi.waitFor(() => expect(submitButton().disabled).toBe(false));
    expect(submitButton().textContent).toBe('Create invoice');
  });
});

describe('client validation', () => {
  test('an empty form shows field errors, focuses the first one and sends nothing', () => {
    submit();

    expect(fetchMock).not.toHaveBeenCalled();
    for (const name of ['sellerName', 'customerName', 'items[0].description', 'items[0].unitPriceCents']) {
      expect(input(name).getAttribute('aria-invalid')).toBe('true');
      expect(errorFor(name).hidden).toBe(false);
    }
    expect(errorFor('sellerName').textContent).toBe('Required.');
    expect(document.activeElement).toBe(input('sellerName'));
  });

  test.each(['0', '1.5', '-1', '1000001', 'abc', ''])('rejects quantity %j', quantity => {
    fillValidInvoice();
    type('items[0].quantity', quantity);

    submit();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(input('items[0].quantity').getAttribute('aria-invalid')).toBe('true');
  });

  test.each(['12.999', '-5', '1,299', 'free'])('rejects price %j', price => {
    fillValidInvoice();
    type('items[0].unitPriceCents', price);

    submit();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorFor('items[0].unitPriceCents').textContent).toBe('Enter a price like 12.99.');
  });

  test('rejects names longer than 200 characters even if maxlength is bypassed', () => {
    fillValidInvoice();
    type('customerName', 'x'.repeat(201));

    submit();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorFor('customerName').textContent).toBe('Use at most 200 characters.');
  });

  test('errors clear on the next valid submit', async () => {
    submit();
    expect(input('sellerName').getAttribute('aria-invalid')).toBe('true');

    fetchMock.mockResolvedValue(jsonResponse(201, {}));
    fillValidInvoice();
    submit();

    expect(form.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
    expect(errorFor('sellerName').hidden).toBe(true);
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});

describe('server errors', () => {
  test('a server error naming a field is shown next to that input', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, {
      error: {
        code: 'INVALID_INVOICE',
        message: 'Expected an integer between 0 and 9007199254740991.',
        field: 'items[1].unitPriceCents'
      }
    }));
    fillValidInvoice();
    form.querySelector('.add-item').click();
    type('items[1].description', 'Fries');
    type('items[1].unitPriceCents', '4.99');

    submit();

    await vi.waitFor(() => expect(input('items[1].unitPriceCents').getAttribute('aria-invalid')).toBe('true'));
    expect(errorFor('items[1].unitPriceCents').textContent).toBe('Expected an integer between 0 and 9007199254740991.');
    expect(formError().hidden).toBe(true);
    expect(onCreated).not.toHaveBeenCalled();
  });

  test('a server error without a field is shown above the form', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }
    }));
    fillValidInvoice();

    submit();

    await vi.waitFor(() => expect(formError().hidden).toBe(false));
    expect(formError().textContent).toBe('An unexpected error occurred.');
    expect(formError().getAttribute('role')).toBe('alert');
    expect(submitButton().disabled).toBe(false);
  });

  test('a server error for a field the form does not have falls back to the banner', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, {
      error: { code: 'INVALID_INVOICE', message: 'Calculated amount is too large.', field: 'totalCents' }
    }));
    fillValidInvoice();

    submit();

    await vi.waitFor(() => expect(formError().textContent).toBe('Calculated amount is too large.'));
  });

  test('a network failure keeps the typed values and shows a retry message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    fillValidInvoice();

    submit();

    await vi.waitFor(() => expect(formError().hidden).toBe(false));
    expect(formError().textContent).toMatch(/could not reach the server/i);
    expect(input('sellerName').value).toBe('  Demo Donair Shop ');
  });
});
