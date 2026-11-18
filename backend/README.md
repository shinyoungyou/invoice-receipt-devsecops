# Shared invoice backend

One Express application and one SQLite schema, maintained by two feature owners:

| Owner | Scope | Branch |
| --- | --- | --- |
| Member 2 — Backend 1 | Invoice validation/totals, persistence, create/list/detail/search, currency conversion | `feature/backend-invoices` |
| Member 3 — Backend 2 | Checkout, webhook verification, payment status transitions and PDF receipts | `feature/backend-payments` |

Each owner writes tests and maintains CI for their own area. Member 2 also
coordinates the shared SonarQube project and backend coverage report.

## Setup

Start at the repository root in a checkout containing Member 2's invoice
implementation. Use Node.js 22.23.4 to match CI. The backend accepts Node 22.x
from 22.16 onward and uses its built-in SQLite driver. With nvm, use
`nvm install 22.23.4` and `nvm use 22.23.4` to select the team version.

```bash
cd backend
node --version
npm ci
```

Create `backend/.env` from the example on first use. Run one of the following
from `backend/`. On macOS or Linux, use

```bash
if [ ! -f .env ]; then cp .env.example .env; fi
```

In Windows PowerShell, use

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

If PowerShell blocks `npm.ps1`, run the npm commands as `npm.cmd`, for example
`npm.cmd ci`. The example configures these local defaults

```dotenv
PORT=3000
HOST=127.0.0.1
NODE_ENV=development
DATABASE_PATH=./data/invoices.db
```

```bash
npm run db:init
npm run check
npm test
npm run dev
```

Leave the dev server running. Visit `http://127.0.0.1:3000/api/health` to
check connectivity. With the defaults it returns

```json
{"status":"ok","service":"invoice-receipt-backend"}
```

The invoice API and test suite run with the example settings. Only a live
USD estimate needs a connection to the Bank of Canada. Checkout needs Stripe
test-mode keys in `.env`; without them checkout and the webhook return
`503 PAYMENTS_UNAVAILABLE` and everything else works. See the
[Stripe test-mode setup](payments/README.md#run-payments-locally-in-stripe-test-mode). SonarQube runs separately from the application
and tests. See the [shared scan instructions](../.github/workflows/README.md).

## Try an invoice

With the server running on the default port, open a second terminal, run
`node` and paste the following into its interactive prompt. This saves a
fictional invoice in the local database and fetches it using the returned ID.

```js
const invoices = 'http://127.0.0.1:3000/api/invoices'
const response = await fetch(invoices, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sellerName: 'Demo Donair Shop', customerName: 'Demo Customer', taxRateBps: 500,
    items: [{ description: 'Chicken donair', quantity: 2, unitPriceCents: 1299 }]
  })
})
const invoice = await response.json()
console.log(response.status, invoice.status, invoice.totalCents)
const detail = await fetch(invoices + '/' + invoice.id)
console.log(detail.status, (await detail.json()).id === invoice.id)
```

Expect `201 unpaid 2728` and `200 true`. Enter `.exit` to leave the Node prompt.
For search and conversion requests, see the [API contract](../docs/api-contract.md).

## Available commands

| Command | What it does |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Watch source files and restart |
| `npm run db:init` | Initialize SQLite without deleting existing data |
| `npm run check` | JavaScript syntax checks; not a linter |
| `npm test` | Discover all backend tests with Node's test runner |
| `npm run test:coverage` | Run backend tests and write `coverage/lcov.info` for SonarQube |

The built-in SQLite experimental warning on Node 22 is expected. Tests use
in-memory or temporary databases and do not need a running server or real API keys.
Both backend owners use this coverage command. CI uploads the LCOV report.

## Ownership and endpoints

| Endpoint or area | Owner |
| --- | --- |
| `POST /api/invoices` | Member 2 |
| `GET /api/invoices` and `GET /api/invoices/:id` | Member 2 |
| `GET /api/invoices/:id/conversion?currency=USD` | Member 2 |
| `POST /api/invoices/:id/checkout` | Member 3 |
| `POST /api/webhooks/stripe` | Member 3 |
| `GET /api/invoices/:id/receipt` | Member 3 |

The health, invoice and conversion endpoints are implemented by Member 2.
The checkout, webhook and receipt endpoints are implemented by Member 3; see
the [payment guide](payments/README.md). The
[API contract](../docs/api-contract.md) covers input fields, pagination,
current payment state and conversion failures. Member 3 can use
`getInvoice(db, id)` from `invoices/repository.js` for a current invoice and
its ordered items. A missing invoice returns `null`.

## Shared files and database contract

Member 2 coordinates `app.js`, `server.js`, package files and migrations. Member 3
reviews payment-related changes and supplies the payment router mount. Agree on
shared-file edits before opening PRs; both may contribute without overwriting
one another's changes. Commit lockfile changes with new dependencies.

The server exposes a database connection as `app.locals.db`. The initial tables
are `invoices`, `invoice_items` and `processed_webhook_events`. Relative database
paths resolve from backend/. Generated data is local and must stay out of Git.
Schema version 1 is tracked with user_version. Add migrations for future schema
changes; editing schema.sql alone does not update existing databases.

Member 2 creates unpaid invoices and owns invoice reads/calculations. Member 3
owns transitions to paid and recording processed Stripe events. M3 must write the
payment update and processed-event record atomically. Do not maintain separate
payment copies of invoices. Member 2's detail response must expose current state.

Both owners use parameterized queries. Money remains CAD integer cents and UTC
ISO timestamps are supplied by the app. Derive receiptUrl in the API instead of
storing it; return null for unpaid invoices.

Mount Stripe's raw-body webhook route BEFORE express.json(). Coordinate this
change in app.js with Member 2; changing parser order can break signatures.
Mount all application routes before the 404 handler. Keep unexpected internal
errors out of client responses.

## Tests and CI

- Member 2 owns calculation, validation, invoice persistence/query and conversion
  tests, plus shared database bootstrap tests and backend-core CI.
- Member 3 owns checkout, signature, duplicate-event, payment consistency and
  receipt tests, plus payment CI.
- Both backend owners review shared schema tests. Run the full backend suite for
  shared-file changes and before merge to catch cross-feature regressions.
- Conversion tests use Bank of Canada fixtures and an isolated database.

See [invoice work](invoices/README.md), [payment work](payments/README.md) and
[workflow ownership](../.github/workflows/README.md).
