// DEMO ONLY (demo/sonar-gate): tests for the receipt reference.
import { afterEach, expect, test, vi } from 'vitest';
import { receiptReference } from '../src/receipt-reference.js';

test('has the RCPT- prefix and 8 unambiguous characters', () => {
  expect(receiptReference()).toMatch(/^RCPT-[A-HJ-NP-Z2-9]{8}$/);
});

test('is different each time', () => {
  const references = new Set(Array.from({ length: 1000 }, receiptReference));
  expect(references.size).toBe(1000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('uses the cryptographically secure generator, not Math.random', () => {
  const secure = vi.spyOn(crypto, 'getRandomValues');
  const weak = vi.spyOn(Math, 'random');

  receiptReference();

  expect(secure).toHaveBeenCalledOnce();
  expect(weak).not.toHaveBeenCalled();
});

test('maps random bytes onto the alphabet', () => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
    array.set([0, 31, 32, 255, 1, 2, 3, 4]);
    return array;
  });

  expect(receiptReference()).toBe('RCPT-A9A9BCDE');
});
