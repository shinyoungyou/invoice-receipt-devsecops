# Backend 2 payment and receipts

Owner: **Member 3**. Branch: `feature/backend-payments`.
Own implementation, tests and CI for payment and receipt features inside the
shared backend. This README defines planned work; it does not add payment code.

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

Agree on invoice lookup, current status and transaction boundaries with Member 2.
The existing schema already has payment-related fields and an event table; reuse
it. Any additional fields require an agreed migration, not a parallel database.

Start immediately with synthetic invoice fixtures, mocked Stripe calls, endpoint
contracts and tests. Real integration depends on Member 2's persisted invoices.
Send Member 1 the checkout response, pending/paid behavior and receipt response
contract before frontend integration. Member 1 refetches state after redirects.

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

Maintain `backend-payments-ci.yml` and its payment checks. Add coverage reporting
compatible with the shared backend tool chosen with Member 2. Keep Stripe test
keys/webhook secrets out of Git and never require real credentials for unit tests.
Document the test-mode environment variables when implementing the feature.

Coordinate the SINGLE repository-wide CodeQL setup, with input from both teammates.
Each member fixes findings in their own code. Prepare a confirmed CodeQL finding
and fix demonstration and explain payment-specific tests that scanning cannot
replace. Review SonarQube findings in payment code with Member 2.

## Done when

An invoice can be paid in test mode, only a verified event marks it paid, duplicate
webhooks are harmless, and a correct paid receipt is downloadable. Payment tests
and CI pass, setup is documented and Member 1 can demonstrate the full UI flow.
