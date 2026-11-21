import { getUsdEstimate } from '../api.js';
import { el } from '../dom.js';
import { formatMoney } from '../money.js';
import { isAbort, showUnexpectedError } from './shared.js';

const RATE_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeZone: 'UTC' });

// rateDate is a calendar date ("2026-11-09"). Formatting it in UTC keeps it
// from shifting to the previous day in time zones west of UTC.
export function formatRateDate(rateDate) {
  const date = new Date(`${rateDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? rateDate : RATE_DATE_FORMAT.format(date);
}

function note(text, className = 'text-slate-600') {
  return el('p', { class: `text-sm ${className}`, text });
}

function estimateView(estimate) {
  return el('div', { class: 'space-y-1' }, [
    el('p', {}, [
      el('span', { class: 'text-sm text-slate-600', text: 'Estimated USD equivalent — charged in CAD: ' }),
      el('strong', { class: 'estimate-amount tabular-nums', text: formatMoney(estimate.estimatedTotalCents, 'USD') })
    ]),
    note(`${estimate.source} rate ${estimate.cadPerUsd} CAD per USD, ${formatRateDate(estimate.rateDate)}. ` +
      'For reference only; the payment is in CAD.')
  ]);
}

async function loadEstimate(section, { invoiceId, signal }) {
  section.replaceChildren(note('Checking the USD estimate…'));

  let estimate;
  try {
    estimate = await getUsdEstimate(invoiceId, { signal });
  } catch (error) {
    if (isAbort(error)) return;
    const unavailable = error.code === 'RATE_UNAVAILABLE'
      ? 'The USD estimate is unavailable right now.'
      : `The USD estimate is unavailable. ${error.message}`;
    section.replaceChildren(
      note(`${unavailable} The invoice is still charged in CAD.`),
      el('button', {
        type: 'button',
        class: 'retry-estimate text-sm text-indigo-700 underline hover:text-indigo-900',
        text: 'Try again',
        onclick: () => showUsdEstimate(section, { invoiceId, signal })
      })
    );
    return;
  }

  section.replaceChildren(estimateView(estimate));
}

/**
 * Loads the dated USD estimate into `section` without blocking the invoice.
 * Returns nothing: failures are shown in the section, never left unhandled.
 */
export function showUsdEstimate(section, { invoiceId, signal }) {
  loadEstimate(section, { invoiceId, signal }).catch(err => showUnexpectedError(section, err));
}
