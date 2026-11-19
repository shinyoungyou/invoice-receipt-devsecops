import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })));
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

test('renders the invoice list into #app on the home page', async () => {
  await import('../src/main.js');

  await vi.waitFor(() => expect(document.querySelector('.empty-state')).not.toBeNull());
  expect(document.querySelector('#app h1')?.textContent).toBe('Invoices');
});
