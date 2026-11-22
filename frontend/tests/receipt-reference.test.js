// DEMO ONLY (demo/sonar-gate): tests for the receipt reference.
import { expect, test } from 'vitest';
import { receiptReference } from '../src/receipt-reference.js';

test('has the RCPT- prefix and 8 unambiguous characters', () => {
  expect(receiptReference()).toMatch(/^RCPT-[A-HJ-NP-Z2-9]{8}$/);
});

test('is different each time', () => {
  const references = new Set(Array.from({ length: 1000 }, receiptReference));
  expect(references.size).toBe(1000);
});
