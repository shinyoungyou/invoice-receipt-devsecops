const observationsUrl = 'https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1';

function readObservation(payload) {
  const observation = payload?.observations?.[0];
  const rateDate = observation?.d;
  const cadPerUsd = observation?.FXUSDCAD?.v;
  if (typeof rateDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rateDate) ||
      typeof cadPerUsd !== 'string' || !/^\d{1,8}(?:\.\d{1,8})?$/.test(cadPerUsd) || Number(cadPerUsd) <= 0) {
    throw new Error('Invalid Bank of Canada observation.');
  }
  const parsed = new Date(rateDate);
  if (!Number.isFinite(parsed.getTime()) || !parsed.toISOString().startsWith(rateDate)) {
    throw new Error('Invalid Bank of Canada observation date.');
  }
  return { rateDate, cadPerUsd };
}

// The Bank publishes once per business day. Share one in-flight request and
// reuse successful observations for an hour so new publications become visible.
export function createUsdRateProvider(fetchRate = fetch, now = Date.now) {
  let cached;
  let expiresAt = 0;
  let pending;

  async function refresh() {
    const response = await fetchRate(observationsUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Bank of Canada request failed.');
    cached = readObservation(await response.json());
    expiresAt = now() + 3_600_000;
    return cached;
  }

  return function latestUsdRate() {
    if (cached && now() < expiresAt) return Promise.resolve(cached);
    pending ??= refresh().finally(() => { pending = undefined; });
    return pending;
  };
}

export function estimateUsdCents(cadCents, cadPerUsd) {
  // FXUSDCAD is CAD per USD. Divide using the published decimal's exact scale.
  const [whole, fraction = ''] = cadPerUsd.split('.');
  const numerator = BigInt(cadCents) * 10n ** BigInt(fraction.length);
  const denominator = BigInt(whole + fraction);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  return rounded <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rounded) : null;
}
