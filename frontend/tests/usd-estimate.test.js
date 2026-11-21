import { expect, test } from 'vitest';
import { formatRateDate } from '../src/views/usd-estimate.js';

test('formats the rate date as a calendar date without a time-zone shift', () => {
  // Parsed as local time, "2026-11-09" would be Nov 8 in Vancouver (UTC-8).
  expect(formatRateDate('2026-11-09')).toBe('Nov 9, 2026');
  expect(formatRateDate('2026-01-01')).toBe('Jan 1, 2026');
});

test('falls back to the raw value when the date is not valid', () => {
  expect(formatRateDate('not-a-date')).toBe('not-a-date');
});
