import { getInvoice } from '../api.js';
import { el } from '../dom.js';
import { formatMoney, formatTaxRate } from '../money.js';
import { errorBanner, formatDateTime, isAbort, link, loading, statusBadge } from './shared.js';

function itemsTable(invoice) {
  const money = cents => el('td', { class: 'px-3 py-2 text-right tabular-nums', text: formatMoney(cents) });
  const totalRow = (label, cents, strong = false) => el('tr', { class: strong ? 'font-semibold' : '' }, [
    el('th', { scope: 'row', colspan: 3, class: 'px-3 py-2 text-right font-medium', text: label }),
    el('td', { class: 'px-3 py-2 text-right tabular-nums', text: formatMoney(cents) })
  ]);

  return el('table', { class: 'items-table w-full border-collapse rounded-md bg-white text-left shadow-sm' }, [
    el('thead', { class: 'bg-slate-100 text-sm text-slate-700' }, [
      el('tr', {}, [
        el('th', { scope: 'col', class: 'px-3 py-2 font-medium', text: 'Description' }),
        el('th', { scope: 'col', class: 'px-3 py-2 text-right font-medium', text: 'Qty' }),
        el('th', { scope: 'col', class: 'px-3 py-2 text-right font-medium', text: 'Unit price' }),
        el('th', { scope: 'col', class: 'px-3 py-2 text-right font-medium', text: 'Amount' })
      ])
    ]),
    el('tbody', {}, invoice.items.map(item => el('tr', { class: 'border-t border-slate-200' }, [
      el('td', { class: 'px-3 py-2', text: item.description }),
      el('td', { class: 'px-3 py-2 text-right tabular-nums', text: item.quantity.toLocaleString('en-CA') }),
      money(item.unitPriceCents),
      money(item.lineTotalCents)
    ]))),
    el('tfoot', { class: 'border-t-2 border-slate-300' }, [
      totalRow('Subtotal', invoice.subtotalCents),
      totalRow(`Tax (${formatTaxRate(invoice.taxRateBps)})`, invoice.taxCents),
      totalRow('Total (CAD)', invoice.totalCents, true)
    ])
  ]);
}

function detailView(invoice) {
  const dates = [`Created ${formatDateTime(invoice.createdAt)}`];
  if (invoice.paidAt) dates.push(`Paid ${formatDateTime(invoice.paidAt)}`);

  return el('article', { class: 'invoice-detail space-y-6' }, [
    link('/', '← All invoices', 'text-sm text-indigo-700 underline hover:text-indigo-900'),
    el('header', { class: 'space-y-2' }, [
      el('div', { class: 'flex flex-wrap items-center gap-3' }, [
        el('h1', { class: 'break-all text-2xl font-semibold', tabindex: -1, text: `Invoice ${invoice.invoiceNumber}` }),
        statusBadge(invoice.status)
      ]),
      el('p', { class: 'text-sm text-slate-600', text: dates.join(' · ') })
    ]),
    el('dl', { class: 'grid gap-4 sm:grid-cols-2' }, [
      el('div', {}, [
        el('dt', { class: 'text-sm text-slate-600', text: 'Seller' }),
        el('dd', { class: 'font-medium', text: invoice.sellerName })
      ]),
      el('div', {}, [
        el('dt', { class: 'text-sm text-slate-600', text: 'Customer' }),
        el('dd', { class: 'font-medium', text: invoice.customerName })
      ])
    ]),
    itemsTable(invoice),
    el('section', { class: 'payment space-y-3', 'aria-label': 'Payment' })
  ]);
}

/** Loads one invoice and renders it, or a not-found / error state. */
export async function renderInvoiceDetail(container, { id, signal } = {}) {
  container.replaceChildren(loading('Loading invoice…'));

  let invoice;
  try {
    invoice = await getInvoice(id, { signal });
  } catch (error) {
    if (isAbort(error)) return null;
    if (error.code === 'INVOICE_NOT_FOUND') {
      container.replaceChildren(el('div', { class: 'not-found space-y-3' }, [
        el('h1', { class: 'text-2xl font-semibold', tabindex: -1, text: 'Invoice not found' }),
        el('p', { class: 'text-slate-600', text: 'It may have been mistyped, or it does not exist.' }),
        link('/', 'Back to all invoices')
      ]));
    } else {
      container.replaceChildren(errorBanner(`Could not load this invoice. ${error.message}`, () => {
        renderInvoiceDetail(container, { id, signal });
      }));
    }
    return null;
  }

  container.replaceChildren(detailView(invoice));
  return invoice;
}
