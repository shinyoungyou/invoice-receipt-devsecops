import { el } from '../dom.js';

const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

export function statusBadge(status) {
  const paid = status === 'paid';
  return el('span', {
    class: `status-badge inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
      paid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
    }`,
    text: paid ? 'Paid' : 'Unpaid'
  });
}

export function link(href, text, className = 'text-indigo-700 underline hover:text-indigo-900') {
  return el('a', { href, 'data-link': true, class: className, text });
}

export function loading(message) {
  return el('p', { role: 'status', class: 'loading text-slate-600', text: message });
}

// Error banner with an optional retry button.
export function errorBanner(message, onRetry) {
  return el('div', {
    role: 'alert',
    class: 'error-banner flex items-center justify-between gap-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800'
  }, [
    el('span', { text: message }),
    onRetry && el('button', {
      type: 'button',
      class: 'retry rounded-md border border-red-300 bg-white px-3 py-1 hover:bg-red-100',
      text: 'Try again',
      onclick: onRetry
    })
  ]);
}

export const isAbort = error => error?.name === 'AbortError';
