# Backend 2 payment and receipts

Owner: **Member 3**. Branch: `feature/backend-payments`.
Own implementation, tests and CI for payment and receipt features inside the
shared backend. The checkout, webhook and receipt routes below are planned.

## Features

1. Create a Stripe test Checkout Session for an existing unpaid invoice. Read the
   amount from SQLite, charge CAD and return a checkout URL. Reject zero totals
   and already-paid invoices. Coordinate immutability of amounts once checkout starts.
2. Verify signed webhooks using the original request bytes. Mount the raw-body
   route before the shared JSON parser. Validate invoice identity, payment success,
   amount and currency before changing status.
3. Record processed event IDs and update invoice payment state in one transaction.
   Duplicate delivery must not produce repeated payment side effects. Keep existing
   paid state consistent when later events arrive.
4. Generate a CAD PDF receipt from stored invoice/item data only for a paid invoice.
   Reject unpaid access and handle unknown invoices. Include item breakdown and
   subtotal, tax, total and payment date.

## Dependencies and early work

Member 2's branch can supply real unpaid invoices for local integration. Follow
the [backend walkthrough](../README.md#try-an-invoice) to create one and use
its ID when testing payment routes. From a module in `backend/payments/`, read
the current invoice inside your Express handler with

```js
import { getInvoice } from '../invoices/repository.js';

// Inside the checkout or receipt handler
const invoice = getInvoice(req.app.locals.db, req.params.id);
```

The lookup returns `null` for an unknown ID. Otherwise it includes
`currency`, `totalCents`, `status` and ordered `items`. The shared SQLite
schema already has payment fields and a `processed_webhook_events` table.
Use those records for verified payment updates. Member 1 refetches invoice
detail after a redirect and uses the returned status and receipt URL.

Develop checkout and webhook tests with synthetic invoices and mocked Stripe
calls. Publish the final checkout response and receipt behavior in the
[API contract](../../docs/api-contract.md#payment-and-receipt-handoff) for Member 1.

## Tests owned by Member 3

Cover checkout using the stored CAD amount, zero/paid/unknown invoice rejection,
invalid signatures, incorrect amount/currency, unpaid sessions, valid payment,
duplicate events, transaction rollback and paid/unpaid receipt access. Use
isolated databases and mocked payment calls in CI. Keep live Stripe test-mode
checks as a separate documented integration rehearsal.

Add payment tests to backend/tests/ with clear payment/webhook/receipt filenames.
Avoid changing Member 2's invoice tests except through coordinated review.
Run the shared `npm test` suite before merge; shared changes can affect both areas.

## DevOps and security work owned by Member 3

Add `backend-payments-ci.yml` for the payment checks. Tests named
`*.test.js` under `backend/tests/` run in the existing backend coverage command,
`npm run test:coverage`. Member 2 maintains the [shared SonarQube configuration](../../.github/workflows/README.md).
Keep Stripe test keys and webhook secrets out of Git and use mocks in unit tests.
Document the test-mode environment variables when implementing the feature.

Coordinate the SINGLE repository-wide CodeQL setup, with input from both teammates.
Each member fixes findings in their own code. Prepare a confirmed CodeQL finding
and fix demonstration and explain payment-specific tests that scanning cannot
replace. Review SonarQube findings in payment code with Member 2.

## Done when

An invoice can be paid in test mode, only a verified event marks it paid, duplicate
webhooks are harmless, and a correct paid receipt is downloadable. Payment tests
and CI pass, setup is documented and Member 1 can demonstrate the full UI flow.
