# Backend 2 payment and receipts

Owner: **Member 3**. Branch: `feature/backend-payments`.
Checkout, verified webhooks, payment state and PDF receipts are implemented in
this folder and mounted in the shared Express app. Endpoint details for
Member 1 are in the [API contract](../../docs/api-contract.md#payments-and-receipts).

| File | Responsibility |
| --- | --- |
| `stripe-gateway.js` | The only module that talks to Stripe. Accepts test-mode keys only and verifies webhook signatures. |
| `routes.js` | `POST /api/invoices/:id/checkout`, `GET /api/invoices/:id/receipt` and `POST /api/webhooks/stripe` |
| `repository.js` | Writes the paid state and the processed event ID in one SQLite transaction |
| `receipt.js` | Builds the receipt from the stored invoice and renders the PDF with PDFKit |

## How a payment works

1. The UI calls checkout. The server reads the invoice from SQLite and creates
   a Stripe Checkout Session for the stored CAD total. Amounts sent by the
   browser are ignored. Paid invoices and totals outside Stripe's CAD card limits
   ($0.50 to $999,999.99) are rejected before Stripe is called.
2. The latest session ID is stored on the invoice. Another checkout request
   returns the same session while it is open. If Stripe already completed it
   but the webhook has not arrived, the server answers `409 PAYMENT_PENDING`
   instead of opening a second session that could charge twice.
3. Stripe calls the webhook. The route is mounted before `express.json()` and
   verifies the `Stripe-Signature` header against the raw request bytes.
4. For `checkout.session.completed` or `checkout.session.async_payment_succeeded`
   with `payment_status: paid`, the server checks the invoice ID, metadata,
   payment mode, currency and amount against SQLite. Only then does it set
   `status = 'paid'` and `paid_at`. The event ID goes into
   `processed_webhook_events` in the same transaction.
5. A repeated event ID returns `duplicate` without changes. A later event for an
   already-paid invoice keeps the original payment date. Failed, expired or
   still-pending sessions leave the invoice unpaid.
6. The receipt endpoint renders a PDF only for a paid invoice, using the stored
   items, subtotal, tax, CAD total and payment date.

The browser return URL never changes payment state. Only a verified webhook does.

## Run payments locally in Stripe test mode

Unit tests and CI need none of this. Use it for the live rehearsal.

1. In the Stripe Dashboard, switch to **test mode** and copy the secret key
   (`sk_test_…`) from **Developers → API keys**. Use a restricted key
   (`rk_test_…`) with write access to Checkout Sessions if you prefer.
2. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli), run
   `stripe login`, then forward events to the local server.

   ```bash
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://127.0.0.1:3000/api/webhooks/stripe
   ```

   The CLI prints a signing secret (`whsec_…`) that stays the same across runs.
3. Put both values in `backend/.env`. Never commit that file.

   ```dotenv
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. Restart `npm run dev`, create an invoice ([walkthrough](../README.md#try-an-invoice))
   and start checkout from the Node prompt.

   ```js
   const id = invoice.id
   const session = await fetch(`http://127.0.0.1:3000/api/invoices/${id}/checkout`, { method: 'POST' }).then(r => r.json())
   console.log(session.checkoutUrl)
   ```

5. Open the URL and pay with the test card `4242 4242 4242 4242`, any future
   expiry date and any CVC. The `stripe listen` terminal shows a `200` response.
   `GET /api/invoices/:id` then reports `paid` and a `receiptUrl`. Open
   `http://127.0.0.1:3000/api/invoices/<id>/receipt` to download the PDF.

To see the defences, run `stripe trigger checkout.session.completed`. Stripe's
sample event has no matching invoice, so the server answers `400 INVALID_EVENT`
and changes nothing. Resend a real event with `stripe events resend <evt_id>`
to see `duplicate`.

After checkout, Stripe sends the browser to `CHECKOUT_SUCCESS_URL` or
`CHECKOUT_CANCEL_URL`. Both default to `http://localhost:5173/invoices/{INVOICE_ID}`
with a `checkout` query parameter. Member 1 should set them to the real UI
route once the frontend exists. `{CHECKOUT_SESSION_ID}` is also supported.

## Tests owned by Member 3

| File | Covers |
| --- | --- |
| `tests/payment-checkout.test.js` | Stored CAD amount and Stripe parameters, ignored client amounts, session reuse and replacement, pending payment, unknown/paid/zero/out-of-range rejection, provider errors, missing or live keys, return URLs |
| `tests/stripe-webhook.test.js` | Valid payment, missing/invalid/tampered signatures, wrong amount/currency/mode/identity, unknown invoice, unpaid/failed/expired sessions, duplicate and later events, rollback after a failed write, ignored event types, missing webhook secret |
| `tests/payment-receipt.test.js` | Unknown and unpaid refusal, PDF download headers and bytes, receipt values from stored data, multi-page receipts, CAD formatting |

Stripe calls are mocked. Webhook tests sign events with a synthetic secret
through Stripe's own `generateTestHeaderString`, so real signature verification
runs. Each test uses an in-memory SQLite database. The rollback test installs a
trigger that makes the event insert fail, then confirms the invoice stayed unpaid
and that the redelivered event succeeds.

From `backend/`, run the payment tests alone or the shared suite.

```bash
node --test tests/payment-checkout.test.js tests/stripe-webhook.test.js tests/payment-receipt.test.js
npm test
```

## CI and security scanning

- [`backend-payments-ci.yml`](../../.github/workflows/backend-payments-ci.yml)
  runs on pull requests to `main` and pushes to `main` or
  `feature/backend-payments`. It fails on committed live Stripe credentials,
  audits runtime dependencies for high-severity advisories, checks syntax, runs
  the payment tests with a readable report and then runs the full backend suite.
- Security scanning uses the team's SonarQube project. The payment tests and
  coverage are part of `npm run test:coverage`, so payment code reaches the
  SonarQube quality gate through Member 2's existing job on `main`.

What scanning cannot replace: SonarQube looks for code patterns. They
cannot tell whether a paid amount matches the invoice, whether a duplicate event
is harmless or whether a failed write rolls back. The webhook and checkout tests
above check that behavior.

## Still to do with the team

- Live Stripe test-mode rehearsal with Member 1's UI, recorded in
  [demo evidence](../../docs/demo-evidence.md).
- Review payment-code SonarQube findings with Member 2 after the merge to `main`.
  Record a finding before fixing it. Do not add a vulnerability to `main` to create one.
- The receipt is available to anyone who knows the invoice ID. That is acceptable
  for a controlled demo only. Add authentication before any wider exposure.
