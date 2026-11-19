import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = '';
});

test('renders the new invoice form into #app', async () => {
  await import('../src/main.js');

  const heading = document.querySelector('#app h1');
  expect(heading?.textContent).toBe('New invoice');
});
