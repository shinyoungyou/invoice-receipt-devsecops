import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// apiUrl() is internal; it is exercised through a module whose invoice-path
// guard is bypassed, so the second layer can be tested on its own.
let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test('paths that leave /api/ after normalization are refused before fetch', async () => {
  const { listInvoices } = await import('../src/api.js');
  const realURL = URL;
  // Simulate a path that would normalize outside the API.
  vi.stubGlobal('URL', class extends realURL {
    constructor(input, base) {
      super(String(input).replace('/api/invoices', '/api/../outside'), base);
    }
  });

  await expect(listInvoices()).rejects.toMatchObject({ code: 'INVALID_REQUEST_PATH' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a different origin is refused before fetch', async () => {
  const { listInvoices } = await import('../src/api.js');
  const realURL = URL;
  vi.stubGlobal('URL', class extends realURL {
    constructor() {
      super('https://evil.example/api/invoices');
    }
  });

  await expect(listInvoices()).rejects.toMatchObject({ code: 'INVALID_REQUEST_PATH' });
  expect(fetchMock).not.toHaveBeenCalled();
});
