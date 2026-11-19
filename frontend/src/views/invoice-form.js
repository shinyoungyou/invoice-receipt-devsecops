import { createInvoice } from '../api.js';
import { el } from '../dom.js';
import { parsePriceToCents } from '../money.js';
import { link } from './shared.js';

// Limits mirror backend/invoices/validation.js. The backend still validates
// everything; these checks only give faster, friendlier feedback.
const NAME_MAX = 200;
const DESCRIPTION_MAX = 500;
const QUANTITY_MAX = 1_000_000;
const ITEMS_MAX = 100;

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ' +
  'aria-[invalid=true]:border-red-600';
const LABEL_CLASS = 'block text-sm font-medium text-slate-700';
const ERROR_CLASS = 'mt-1 text-sm text-red-700';

let fieldIds = 0;

// One labelled input (or select) with its own error message slot.
function field({ label, name, input }) {
  fieldIds += 1;
  const id = `invoice-field-${fieldIds}`;
  const errorId = `${id}-error`;
  input.id = id;
  input.dataset.field = name;
  input.setAttribute('aria-describedby', errorId);
  return el('div', { class: 'field' }, [
    el('label', { for: id, class: LABEL_CLASS, text: label }),
    input,
    el('p', { id: errorId, class: ERROR_CLASS, hidden: true })
  ]);
}

function itemRow() {
  const row = el('fieldset', {
    class: 'item-row grid gap-3 rounded-md border border-slate-200 p-4 sm:grid-cols-[1fr_7rem_8rem_auto] sm:items-start'
  });
  const legend = el('legend', { class: 'px-1 text-sm font-medium text-slate-600' });
  const description = el('input', { type: 'text', class: INPUT_CLASS, maxlength: DESCRIPTION_MAX, required: true });
  const quantity = el('input', {
    type: 'number', class: INPUT_CLASS, min: 1, max: QUANTITY_MAX, step: 1, value: '1', required: true
  });
  const price = el('input', {
    type: 'text', class: INPUT_CLASS, inputmode: 'decimal', placeholder: '0.00', autocomplete: 'off', required: true
  });
  const remove = el('button', {
    type: 'button',
    class: 'remove-item self-end rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:invisible',
    text: 'Remove'
  });

  row.append(
    legend,
    field({ label: 'Description', name: 'description', input: description }),
    field({ label: 'Quantity', name: 'quantity', input: quantity }),
    field({ label: 'Unit price (CAD)', name: 'unitPriceCents', input: price }),
    remove
  );
  return row;
}

/**
 * Renders the create-invoice form into `container`.
 * Calls `onCreated(invoice)` with the server's response after a successful create.
 */
export function renderInvoiceForm(container, { onCreated }) {
  const formError = el('div', {
    role: 'alert',
    class: 'form-error rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800',
    hidden: true
  });

  const sellerName = el('input', { type: 'text', class: INPUT_CLASS, maxlength: NAME_MAX, required: true, autocomplete: 'organization' });
  const customerName = el('input', { type: 'text', class: INPUT_CLASS, maxlength: NAME_MAX, required: true });
  const taxRate = el('select', { class: INPUT_CLASS }, [
    el('option', { value: '500', text: '5% GST' }),
    el('option', { value: '0', text: '0% (tax-exempt)' })
  ]);

  const items = el('div', { class: 'items space-y-3' });
  const addItem = el('button', {
    type: 'button',
    class: 'add-item rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50',
    text: 'Add item'
  });
  const submit = el('button', {
    type: 'submit',
    class: 'rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60',
    text: 'Create invoice'
  });

  const form = el('form', { class: 'invoice-form space-y-6', novalidate: true, 'aria-labelledby': 'invoice-form-title' }, [
    link('/', '← All invoices', 'text-sm text-indigo-700 underline hover:text-indigo-900'),
    el('h1', { id: 'invoice-form-title', class: 'text-2xl font-semibold', tabindex: -1, text: 'New invoice' }),
    formError,
    el('div', { class: 'grid gap-4 sm:grid-cols-2' }, [
      field({ label: 'Seller name', name: 'sellerName', input: sellerName }),
      field({ label: 'Customer name', name: 'customerName', input: customerName })
    ]),
    el('div', { class: 'sm:w-64' }, [field({ label: 'Tax rate', name: 'taxRateBps', input: taxRate })]),
    el('section', { class: 'space-y-3', 'aria-label': 'Line items' }, [
      el('h2', { class: 'text-lg font-medium', text: 'Items' }),
      items,
      addItem
    ]),
    el('p', { class: 'text-sm text-slate-600', text: 'Totals and tax are calculated by the server and charged in CAD.' }),
    submit
  ]);

  // Keeps item labels, field names and buttons in sync after add/remove.
  function renumberItems() {
    const rows = [...items.querySelectorAll('.item-row')];
    rows.forEach((row, index) => {
      row.querySelector('legend').textContent = `Item ${index + 1}`;
      for (const input of row.querySelectorAll('[data-field]')) {
        const key = input.dataset.field.split('.').pop();
        input.dataset.field = `items[${index}].${key}`;
      }
      row.querySelector('.remove-item').disabled = rows.length === 1;
      row.querySelector('.remove-item').setAttribute('aria-label', `Remove item ${index + 1}`);
    });
    addItem.disabled = rows.length >= ITEMS_MAX;
  }

  function appendItem() {
    const row = itemRow();
    row.querySelector('.remove-item').addEventListener('click', () => {
      row.remove();
      renumberItems();
    });
    items.append(row);
    renumberItems();
    return row;
  }

  function clearErrors() {
    formError.hidden = true;
    formError.textContent = '';
    for (const input of form.querySelectorAll('[data-field]')) {
      input.removeAttribute('aria-invalid');
      const message = document.getElementById(input.getAttribute('aria-describedby'));
      message.textContent = '';
      message.hidden = true;
    }
  }

  // Returns false when `fieldName` has no matching input on the form.
  function showFieldError(fieldName, message) {
    const input = form.querySelector(`[data-field="${CSS.escape(fieldName)}"]`);
    if (!input) return false;
    input.setAttribute('aria-invalid', 'true');
    const slot = document.getElementById(input.getAttribute('aria-describedby'));
    slot.textContent = message;
    slot.hidden = false;
    return true;
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function focusFirstError() {
    const first = form.querySelector('[aria-invalid="true"]');
    (first ?? formError).focus?.();
  }

  // Reads and checks the form. Returns { invoice } or { errors: [[field, message]] }.
  function readForm() {
    const errors = [];
    const text = (input, name, max) => {
      const value = input.value.trim();
      if (!value) errors.push([name, 'Required.']);
      else if (value.length > max) errors.push([name, `Use at most ${max} characters.`]);
      return value;
    };

    const invoice = {
      sellerName: text(sellerName, 'sellerName', NAME_MAX),
      customerName: text(customerName, 'customerName', NAME_MAX),
      taxRateBps: Number(taxRate.value),
      items: []
    };

    items.querySelectorAll('.item-row').forEach((row, index) => {
      const input = key => row.querySelector(`[data-field="items[${index}].${key}"]`);
      const prefix = `items[${index}]`;

      const description = text(input('description'), `${prefix}.description`, DESCRIPTION_MAX);

      const quantityText = input('quantity').value.trim();
      const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : NaN;
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > QUANTITY_MAX) {
        errors.push([`${prefix}.quantity`, 'Enter a whole number from 1 to 1,000,000.']);
      }

      const unitPriceCents = parsePriceToCents(input('unitPriceCents').value);
      if (unitPriceCents === null) {
        errors.push([`${prefix}.unitPriceCents`, 'Enter a price like 12.99.']);
      }

      invoice.items.push({ description, quantity, unitPriceCents });
    });

    return errors.length ? { errors } : { invoice };
  }

  addItem.addEventListener('click', () => {
    appendItem().querySelector('input').focus();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearErrors();

    const { invoice, errors } = readForm();
    if (errors) {
      for (const [name, message] of errors) showFieldError(name, message);
      focusFirstError();
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Creating…';
    try {
      const created = await createInvoice(invoice);
      onCreated(created);
    } catch (error) {
      // The server is the source of truth: show its message next to the
      // matching input when it names a field we have, otherwise above the form.
      if (!(error.field && showFieldError(error.field, error.message))) {
        showFormError(error.message ?? 'Something went wrong. Please try again.');
      }
      focusFirstError();
    } finally {
      submit.disabled = false;
      submit.textContent = 'Create invoice';
    }
  });

  formError.tabIndex = -1;
  appendItem();
  container.replaceChildren(form);
  return form;
}
