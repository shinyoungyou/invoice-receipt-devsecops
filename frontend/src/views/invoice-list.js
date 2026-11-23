import { listInvoices } from '../api.js';
import { el } from '../dom.js';
import { formatMoney } from '../money.js';
import { navigate } from '../router.js';
import { errorBanner, formatDateTime, isAbort, link, loading, showUnexpectedError, statusBadge } from './shared.js';

export const PAGE_SIZE = 50;

function invoiceRow(invoice) {
  return el('tr', { class: 'border-t border-slate-200' }, [
    el('td', { class: 'px-3 py-2' }, [
      link(`/invoices/${encodeURIComponent(invoice.id)}`, invoice.invoiceNumber, 'break-all text-indigo-700 underline hover:text-indigo-900')
    ]),
    el('td', { class: 'px-3 py-2', text: invoice.sellerName }),
    el('td', { class: 'px-3 py-2', text: invoice.customerName }),
    el('td', { class: 'px-3 py-2 text-right tabular-nums', text: formatMoney(invoice.totalCents) }),
    el('td', { class: 'px-3 py-2' }, [statusBadge(invoice.status)]),
    el('td', { class: 'px-3 py-2 text-sm text-slate-600', text: formatDateTime(invoice.createdAt) })
  ]);
}

/**
 * Renders the invoice list with search. The search term lives in the URL
 * (?q=) so results survive a reload and the back button works.
 */
export function renderInvoiceList(container, { query = '', signal } = {}) {
  const searchInput = el('input', {
    id: 'invoice-search',
    type: 'search',
    name: 'q',
    value: query,
    placeholder: 'Invoice number, seller or customer',
    class: 'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  });
  const searchForm = el('form', { role: 'search', class: 'search-form flex items-end gap-2' }, [
    el('div', { class: 'flex-1' }, [
      el('label', { for: 'invoice-search', class: 'block text-sm font-medium text-slate-700', text: 'Search invoices' }),
      searchInput
    ]),
    el('button', {
      type: 'submit',
      class: 'rounded-md border border-slate-300 bg-white px-4 py-2 hover:bg-slate-100',
      text: 'Search'
    })
  ]);
  const results = el('div', { class: 'results', 'aria-live': 'polite' });

  container.replaceChildren(
    el('div', { class: 'space-y-6' }, [
      el('div', { class: 'flex items-center justify-between gap-4' }, [
        el('h1', { class: 'text-2xl font-semibold', tabindex: -1, text: 'Invoices' }),
        link('/invoices/new', 'New invoice', 'new-invoice rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700')
      ]),
      searchForm,
      results
    ])
  );

  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    const q = searchInput.value.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
  });

  const rows = el('tbody');
  const table = el('table', { class: 'w-full border-collapse overflow-hidden rounded-md bg-white text-left shadow-sm' }, [
    el('thead', { class: 'bg-slate-100 text-sm text-slate-700' }, [
      el('tr', {}, ['Invoice', 'Seller', 'Customer', 'Total (CAD)', 'Status', 'Created'].map((heading, index) =>
        el('th', { scope: 'col', class: `px-3 py-2 font-medium ${index === 3 ? 'text-right' : ''}`, text: heading })
      ))
    ]),
    rows
  ]);
  const loadMore = el('button', {
    type: 'button',
    class: 'load-more mt-4 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100',
    text: 'Load more'
  });

  // For button handlers: an unexpected error is shown instead of being lost.
  // Returns nothing, so callers have no promise left to handle.
  function loadPageSafely(offset) {
    loadPage(offset).catch(err => showUnexpectedError(results, err));
  }

  async function loadPage(offset) {
    if (offset === 0) results.replaceChildren(loading('Loading invoices…'));
    else loadMore.disabled = true;

    let page;
    try {
      page = await listInvoices({ q: query, limit: PAGE_SIZE, offset }, { signal });
    } catch (error) {
      if (isAbort(error)) return;
      const banner = errorBanner(`Could not load invoices. ${error.message}`, () => {
        banner.remove();
        loadPageSafely(offset);
      });
      if (offset === 0) results.replaceChildren(banner);
      else {
        loadMore.disabled = false;
        results.prepend(banner);
      }
      return;
    }

    if (offset === 0 && page.length === 0) {
      results.replaceChildren(el('p', {
        class: 'empty-state rounded-md border border-dashed border-slate-300 p-6 text-center text-slate-600',
        text: query ? `No invoices match “${query}”.` : 'No invoices yet. Create your first one.'
      }));
      return;
    }

    if (offset === 0) results.replaceChildren(table);
    rows.append(...page.map(invoiceRow));

    loadMore.disabled = false;
    loadMore.onclick = () => loadPageSafely(offset + page.length);
    if (page.length === PAGE_SIZE) results.append(loadMore);
    else loadMore.remove();
  }

  return loadPage(0);
}
