# Member 2 invoice backend

Member 2 owns validation, invoice persistence and reads, and USD estimates on
`feature/backend-invoices`. The [API contract](../../docs/api-contract.md)
contains the create request, response fields, errors, list parameters and
conversion example.

## Frontend and payment handoff

- Member 1 can create an invoice at `POST /api/invoices`, use its `Location`
  for details and search with `GET /api/invoices?q=…`. Detail includes ordered
  items. List entries carry the same totals and payment status.
- Member 3 can import `getInvoice(db, id)` from `repository.js` with
  `req.app.locals.db`. It returns the stored CAD total, ordered items and
  current payment state, or `null` for a missing ID. Member 3 owns verified
  payment updates and receipt generation. The read API derives the receipt URL
  from the stored status.
- The estimate endpoint uses the most recent observation from Bank of Canada's
  `FXUSDCAD` series. A successful rate is cached in memory for one hour.
  Each refresh has a five-second timeout. On HTTP 503 the UI can show the CAD
  total and continue the checkout flow.

## Calculations and storage

`validateInvoiceInput` normalizes a copy of the request and rejects unsupported
fields. `calculateInvoiceTotals` independently validates its items and rate,
uses integer arithmetic for intermediate amounts and rounds tax half up once
on the subtotal. All returned amounts are JSON-safe integer cents.

`createInvoice` inserts the unpaid invoice and its ordered items inside one
SQLite transaction. The existing shared schema stores all source amounts in CAD.
Names, search terms, paging values and IDs are bound SQL parameters.

## Verification

From `backend/`, run `npm run check`, `npm test` and `npm run test:coverage`.
The suite covers field validation, tampered input, monetary limits, rollback,
search and paging, shared payment state, rate direction, rounding and outages.
Member 2 maintains backend-core CI and the team's SonarQube configuration.
The workflow publishes `backend/coverage/lcov.info` and the SonarQube job
uses it for the quality gate on `main`. Teammates can follow the
[scan instructions](../../.github/workflows/README.md) and review
the [test and scan evidence](../../docs/demo-evidence.md).
