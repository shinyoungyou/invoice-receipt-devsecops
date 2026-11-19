import './style.css';
import { el } from './dom.js';
import { interceptLinks, matchRoute, navigate } from './router.js';
import { renderInvoiceDetail } from './views/invoice-detail.js';
import { renderInvoiceForm } from './views/invoice-form.js';
import { renderInvoiceList } from './views/invoice-list.js';
import { link } from './views/shared.js';

const app = document.querySelector('#app');
const APP_NAME = 'Invoice and Receipt Generator';

// Aborts the previous screen's requests so a slow response cannot
// overwrite the screen the user has already moved to.
let current = null;

async function render({ moveFocus }) {
  current?.abort();
  current = new AbortController();
  const { signal } = current;
  const route = matchRoute(location.pathname);

  switch (route.name) {
    case 'list': {
      document.title = `Invoices · ${APP_NAME}`;
      const query = new URLSearchParams(location.search).get('q') ?? '';
      await renderInvoiceList(app, { query, signal });
      break;
    }
    case 'new':
      document.title = `New invoice · ${APP_NAME}`;
      renderInvoiceForm(app, {
        onCreated: invoice => navigate(`/invoices/${encodeURIComponent(invoice.id)}`)
      });
      break;
    case 'detail': {
      document.title = `Invoice · ${APP_NAME}`;
      const invoice = await renderInvoiceDetail(app, { id: route.id, signal });
      if (invoice && !signal.aborted) document.title = `${invoice.invoiceNumber} · ${APP_NAME}`;
      break;
    }
    default:
      document.title = `Page not found · ${APP_NAME}`;
      app.replaceChildren(el('div', { class: 'space-y-3' }, [
        el('h1', { class: 'text-2xl font-semibold', tabindex: -1, text: 'Page not found' }),
        link('/', 'Go to all invoices')
      ]));
  }

  // After in-app navigation, move focus to the new heading for screen readers.
  if (moveFocus && !signal.aborted) app.querySelector('h1')?.focus();
}

interceptLinks(document.body);
window.addEventListener('popstate', () => render({ moveFocus: true }));
render({ moveFocus: false });
