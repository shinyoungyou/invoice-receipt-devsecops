import { getInvoice, startCheckout } from '../api.js';
import { el } from '../dom.js';
import { goToStripeCheckout, isStripeCheckoutUrl } from '../external.js';
import { formatMoney } from '../money.js';
import { formatDateTime, isAbort, showUnexpectedError } from './shared.js';

// After a success redirect, Stripe's webhook usually arrives within seconds.
export const POLL_INTERVAL_MS = 2000;
export const POLL_ATTEMPTS = 15;

const BUTTON_CLASS =
  'pay rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60';

function message(text, tone = 'info') {
  const tones = {
    info: 'border-slate-200 bg-white text-slate-700',
    success: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800'
  };
  return el('p', { class: `payment-message rounded-md border p-3 text-sm ${tones[tone]}`, text });
}

// Resolves after `ms`, or rejects with an AbortError when the page is left.
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Renders the payment area of an invoice.
 *
 * - paid: shows when it was paid
 * - unpaid: shows a "Pay with Stripe" button
 * - back from Stripe with ?checkout=success: waits for the webhook by
 *   re-reading the invoice. The redirect alone never counts as payment.
 *
 * Calls `onPaid(invoice)` when polling sees the invoice become paid.
 * Returns nothing: every failure is shown in `section`.
 */
export function showPayment(section, { invoice, checkout = null, signal, onPaid }) {
  const run = task => {
    task().catch(err => showUnexpectedError(section, err));
  };

  function renderPaid() {
    const prefix = checkout === 'success' ? 'Payment confirmed. ' : '';
    section.replaceChildren(message(`${prefix}Paid on ${formatDateTime(invoice.paidAt)}`, 'success'));
  }

  function renderPayButton(notice) {
    const button = el('button', {
      type: 'button',
      class: BUTTON_CLASS,
      text: `Pay ${formatMoney(invoice.totalCents)} CAD with Stripe`,
      onclick: () => run(() => pay(button))
    });
    section.replaceChildren(...[
      notice,
      button,
      el('p', {
        class: 'text-xs text-slate-500',
        text: 'Stripe test mode: use card 4242 4242 4242 4242, any future expiry date and any CVC.'
      })
    ].filter(Boolean));
  }

  async function pay(button) {
    button.disabled = true;
    button.textContent = 'Opening Stripe…';

    let session;
    try {
      session = await startCheckout(invoice.id, { signal });
    } catch (error) {
      if (isAbort(error)) return;
      handleCheckoutError(error);
      return;
    }

    if (!isStripeCheckoutUrl(session.checkoutUrl)) {
      renderPayButton(message('The server returned an unexpected payment page, so it was not opened.', 'error'));
      return;
    }
    goToStripeCheckout(session.checkoutUrl);
  }

  function handleCheckoutError(error) {
    switch (error.code) {
      case 'INVOICE_ALREADY_PAID':
      case 'PAYMENT_PENDING':
        // Stripe has the payment; wait for the server to confirm it.
        run(waitForConfirmation);
        break;
      case 'CHECKOUT_AMOUNT_UNSUPPORTED':
        section.replaceChildren(message(error.message, 'warning'));
        break;
      default:
        renderPayButton(message(`Could not start the payment. ${error.message}`, 'error'));
    }
  }

  async function waitForConfirmation() {
    section.replaceChildren(message(
      'Payment received by Stripe. Waiting for confirmation… This page updates automatically.',
      'info'
    ));

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        try {
          await delay(POLL_INTERVAL_MS, signal);
        } catch {
          return; // delay only rejects when the page is left
        }
      }

      let latest;
      try {
        latest = await getInvoice(invoice.id, { signal });
      } catch (error) {
        if (isAbort(error)) return;
        continue; // A failed check is retried on the next attempt.
      }

      if (latest.status === 'paid') {
        onPaid(latest);
        return;
      }
    }

    section.replaceChildren(
      message(
        'Stripe has not confirmed this payment yet. You will not be charged twice; check again in a minute.',
        'warning'
      ),
      el('button', {
        type: 'button',
        class: 'check-again rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100',
        text: 'Check again',
        onclick: () => run(waitForConfirmation)
      })
    );
  }

  if (invoice.status === 'paid') {
    renderPaid();
  } else if (checkout === 'success') {
    run(waitForConfirmation);
  } else if (checkout === 'cancelled') {
    renderPayButton(message('Payment was cancelled. You have not been charged.', 'info'));
  } else {
    renderPayButton(null);
  }
}
