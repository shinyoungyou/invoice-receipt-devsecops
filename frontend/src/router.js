// Minimal History API router. Real URLs matter here: Stripe sends the browser
// back to /invoices/:id?checkout=success, so that path must load the invoice.

export function matchRoute(pathname) {
  if (pathname === '/' || pathname === '/invoices') return { name: 'list' };
  if (pathname === '/invoices/new') return { name: 'new' };

  const match = /^\/invoices\/([^/]+)\/?$/.exec(pathname);
  if (match) {
    try {
      return { name: 'detail', id: decodeURIComponent(match[1]) };
    } catch {
      return { name: 'notFound' };
    }
  }
  return { name: 'notFound' };
}

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Lets in-app links (<a data-link>) change the page without a full reload.
// Modified clicks (new tab, etc.) keep the browser's default behaviour.
export function interceptLinks(root) {
  root.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-link]');
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(link.getAttribute('href'));
  });
}
