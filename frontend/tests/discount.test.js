// DEMO ONLY (demo/sonar-gate): tests for the discount helper.
import { describe, expect, test } from 'vitest';
import { applyDiscount, describeDiscount, discountPercent, isValidDiscountCode } from '../src/discount.js';

describe('applyDiscount', () => {
  test('no discount keeps every cent (the float version returned 114 for 115)', () => {
    expect(applyDiscount(115, '')).toBe(115);
    expect(applyDiscount(115, 'NOT-A-CODE')).toBe(115);
  });

  test('every total from $0.00 to $99.99 survives a zero discount unchanged', () => {
    for (let cents = 0; cents < 10000; cents += 1) {
      expect(applyDiscount(cents, null)).toBe(cents);
    }
  });

  test.each([
    [2728, 'STUDENT10', 2455],
    [1000, 'STAFF15', 850],
    [115, 'WELCOME5', 109],
    [1, 'STUDENT10', 1],
    [5, 'STUDENT10', 4],
    [0, 'STAFF15', 0]
  ])('%s cents with %s → %s cents (discount rounded half up)', (total, code, expected) => {
    expect(applyDiscount(total, code)).toBe(expected);
  });

  test('codes are case- and space-insensitive', () => {
    expect(applyDiscount(1000, '  student10 ')).toBe(900);
  });

  test.each([12.5, -1, Number.NaN, '1000'])('rejects %j as cents', value => {
    expect(() => applyDiscount(value, 'STUDENT10')).toThrow(TypeError);
  });
});

describe('discount codes', () => {
  test('known and unknown codes', () => {
    expect(discountPercent('STAFF15')).toBe(15);
    expect(discountPercent('nope')).toBe(0);
    expect(discountPercent(undefined)).toBe(0);
    expect(isValidDiscountCode('welcome5')).toBe(true);
    expect(isValidDiscountCode('')).toBe(false);
  });

  test('describes the saving in cents', () => {
    expect(describeDiscount(2728, 'student10')).toBe('STUDENT10: 10% off, you save 273 cents.');
    expect(describeDiscount(2728, 'nope')).toBe('No discount applied.');
  });
});
