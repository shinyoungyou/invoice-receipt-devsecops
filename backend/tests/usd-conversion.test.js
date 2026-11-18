import assert from 'node:assert/strict';
import { test } from 'node:test';
import app from '../app.js';
import { createUsdRateProvider, estimateUsdCents } from '../exchange-rates/usd.js';
import { input, startInvoiceApi } from './support/invoice-api.js';

const rateDate = '2026-11-09';
const payload = (v = '1.2500', d = rateDate) => ({ observations: [{ d, FXUSDCAD: { v } }] });

test('CAD to USD divides by the published decimal and rounds half up exactly', () => {
  for (const [cents, rate, expected] of [
    [0, '1.2500', 0], [1000, '1.2500', 800], [1, '2', 1], [1, '2.01', 0],
    [Number.MAX_SAFE_INTEGER, '1.0000', Number.MAX_SAFE_INTEGER],
    [Number.MAX_SAFE_INTEGER, '0.9999', null]
  ]) assert.equal(estimateUsdCents(cents, rate), expected);
});

test('the provider coalesces concurrent requests, caches successful rates and refreshes expired entries', async () => {
  let calls = 0;
  let time = 0;
  const latest = createUsdRateProvider(async (url, options) => {
    calls++;
    assert.equal(new URL(url).pathname, '/valet/observations/FXUSDCAD/json');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(payload());
  }, () => time);
  const [first, second] = await Promise.all([latest(), latest()]);
  assert.deepEqual(first, { rateDate, cadPerUsd: '1.2500' });
  assert.deepEqual(second, first);
  assert.deepEqual(await latest(), first);
  assert.equal(calls, 1);
  time += 3_600_000;
  await latest();
  assert.equal(calls, 2);
});

test('failures and malformed observations leave the provider able to retry', async () => {
  const failures = [
    () => { throw new Error('offline'); }, () => new Response(null, { status: 503 }),
    () => new Response('invalid JSON'), () => Response.json({ observations: [] }),
    ...['0', '-1', 'NaN', '1x', null].map(value => () => Response.json(payload(value))),
    () => Response.json(payload('1.25', '2026-02-30'))
  ];
  for (const fail of failures) {
    let request = fail;
    const latest = createUsdRateProvider(() => request());
    await assert.rejects(latest());
    request = () => Response.json(payload());
    assert.equal((await latest()).cadPerUsd, '1.2500');
  }
});

test('conversion returns a dated USD estimate and can fail independently of CAD invoice reads', async t => {
  const { create, url } = await startInvoiceApi(t);
  const invoice = await (await create()).json();
  const path = `${url}/${invoice.id}`;
  const latest = t.mock.method(app.locals, 'latestUsdRate', createUsdRateProvider(() => Response.json(payload())));
  for (const [suffix, status] of [['/missing/conversion', 404], [`/${invoice.id}/conversion?currency=EUR`, 400]]) {
    assert.equal((await fetch(url + suffix)).status, status);
  }
  assert.equal(latest.mock.callCount(), 0);
  const success = await fetch(path + '/conversion?currency=USD');
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), {
    invoiceId: invoice.id, currency: 'CAD', totalCents: 3252,
    estimatedCurrency: 'USD', estimatedTotalCents: 2602, cadPerUsd: '1.2500', rateDate, source: 'Bank of Canada'
  });
  latest.mock.mockImplementation(async () => { throw new Error('service offline'); });
  const failed = await fetch(path + '/conversion');
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).error.code, 'RATE_UNAVAILABLE');
  assert.deepEqual(await (await fetch(path)).json(), invoice);
});

test('unrepresentable USD estimates leave a maximum-sized CAD invoice readable', async t => {
  const { create, url } = await startInvoiceApi(t);
  t.mock.method(app.locals, 'latestUsdRate', async () => ({ rateDate, cadPerUsd: '0.9000' }));
  const invoice = await (await create({
    ...input, taxRateBps: 0, items: [{ description: 'Retail', quantity: 1, unitPriceCents: Number.MAX_SAFE_INTEGER }]
  })).json();
  const response = await fetch(`${url}/${invoice.id}/conversion`);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'ESTIMATE_OUT_OF_RANGE');
});
