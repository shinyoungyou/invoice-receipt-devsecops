import './style.css';
import { el } from './dom.js';
import { formatMoney } from './money.js';
import { renderInvoiceForm } from './views/invoice-form.js';

const app = document.querySelector('#app');

function showForm() {
  renderInvoiceForm(app, { onCreated: showCreated });
}

// Temporary confirmation until the invoice detail screen exists.
function showCreated(invoice) {
  app.replaceChildren(
    el('section', { role: 'status', class: 'space-y-3 rounded-md border border-green-200 bg-green-50 p-4' }, [
      el('h1', { class: 'text-xl font-semibold', text: `Invoice ${invoice.invoiceNumber} created` }),
      el('p', { text: `Total ${formatMoney(invoice.totalCents)} CAD · ${invoice.status}` }),
      el('button', {
        type: 'button',
        class: 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100',
        text: 'Create another invoice',
        onclick: showForm
      })
    ])
  );
}

showForm();
