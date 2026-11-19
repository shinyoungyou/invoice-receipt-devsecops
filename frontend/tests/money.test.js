import { describe, expect, test } from 'vitest';
import { formatMoney, formatTaxRate, parsePriceToCents } from '../src/money.js';

describe('parsePriceToCents', () => {
  test('float math would lose a cent, the string split does not', () => {
    // The bug this module exists to prevent (topic doc, Scenario 2).
    expect(1.15 * 100).toBe(114.99999999999999);
    expect(Math.trunc(1.15 * 100)).toBe(114);

    expect(parsePriceToCents('1.15')).toBe(115);
  });

  test.each([
    ['0.29', 29],
    ['0.57', 57],
    ['4.35', 435],
    ['19.99', 1999],
    ['1099.99', 109999]
  ])('%s converts to %s cents exactly', (text, cents) => {
    expect(parsePriceToCents(text)).toBe(cents);
  });

  test('every price from 0.00 to 99.99 converts exactly', () => {
    for (let cents = 0; cents < 10000; cents += 1) {
      const text = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
      expect(parsePriceToCents(text)).toBe(cents);
    }
  });

  test.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.1', 10],
    ['0', 0],
    ['$12.99', 1299],
    ['  7.25  ', 725]
  ])('accepts %j as %s cents', (text, cents) => {
    expect(parsePriceToCents(text)).toBe(cents);
  });

  test.each([
    '',
    '   ',
    '-1',
    '12.999',
    '1.005',
    '1e3',
    '1,299',
    '.5',
    '12.',
    'abc',
    '$',
    '12.5.0',
    'NaN',
    'Infinity'
  ])('rejects %j', text => {
    expect(parsePriceToCents(text)).toBeNull();
  });

  test.each([undefined, null, 12.99, 1299])('rejects non-string input %j', value => {
    expect(parsePriceToCents(value)).toBeNull();
  });

  test('accepts the largest safe amount and rejects anything larger', () => {
    expect(parsePriceToCents('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parsePriceToCents('90071992547409.92')).toBeNull();
  });
});

describe('formatMoney', () => {
  test.each([
    [2728, '$27.28'],
    [272800, '$2,728.00'],
    [0, '$0.00'],
    [5, '$0.05'],
    [50, '$0.50'],
    [99999999, '$999,999.99'],
    [-130, '-$1.30']
  ])('formats %s cents as %s CAD', (cents, text) => {
    expect(formatMoney(cents)).toBe(text);
  });

  test('formats USD estimates with a distinct prefix', () => {
    expect(formatMoney(1904, 'USD')).toBe('US$19.04');
  });

  test.each([27.28, NaN, '2728', null])('rejects non-integer cents %j', value => {
    expect(() => formatMoney(value)).toThrow(TypeError);
  });

  test('rejects unsupported currencies', () => {
    expect(() => formatMoney(100, 'EUR')).toThrow(RangeError);
  });
});

describe('formatTaxRate', () => {
  test.each([
    [500, '5%'],
    [0, '0%']
  ])('formats %s basis points as %s', (bps, text) => {
    expect(formatTaxRate(bps)).toBe(text);
  });
});
