import './style.css';
import { el } from './dom.js';
import { interceptLinks, matchRoute, navigate } from './router.js';
import { renderInvoiceDetail } from './views/invoice-detail.js';
import { renderInvoiceForm } from './views/invoice-form.js';
import { renderInvoiceList } from './views/invoice-list.js';
import { link, showUnexpectedError } from './views/shared.js';

const app = document.querySelector('#app');
const APP_NAME = 'Invoice and Receipt Generator';

// Aborts the previous screen's requests so a slow response cannot
// overwrite the screen the user has already moved to.
let current = null;

async function render({ moveFocus }) {
  current?.abort();
  current = new AbortController();
  const { signal } = current;

  try {
    await renderRoute(matchRoute(location.pathname), signal);
  } catch (error) {
    // A bug in a view must not leave the page stuck on "Loading…".
    if (!signal.aborted) showUnexpectedError(app, error);
    return;
  }

  // After in-app navigation, move focus to the new heading for screen readers.
  if (moveFocus && !signal.aborted) app.querySelector('h1')?.focus();
}

async function renderRoute(route, signal) {
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
      const checkout = new URLSearchParams(location.search).get('checkout');
      const invoice = await renderInvoiceDetail(app, { id: route.id, signal, checkout });
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
}

// render() handles its own errors, so these calls are deliberately not awaited.
interceptLinks(document.body);
window.addEventListener('popstate', () => {
  void render({ moveFocus: true });
});
void render({ moveFocus: false });
