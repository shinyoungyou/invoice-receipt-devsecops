# Shared invoice backend

One Express application and one SQLite schema, maintained by two feature owners:

| Owner | Scope | Branch |
| --- | --- | --- |
| Member 2 — Backend 1 | Invoice validation/totals, persistence, create/list/detail/search, currency conversion | `feature/backend-invoices` |
| Member 3 — Backend 2 | Checkout, webhook verification, payment status transitions and PDF receipts | `feature/backend-payments` |

Each owner writes tests and maintains CI for their own area. Member 3 is no longer
the dedicated test/DevOps owner for the entire team.

## Setup

Use Node.js 22.x, minimum 22.16, with 22.23.4 as the tested team baseline.
SQLite uses built-in `node:sqlite`; do not reinstall `better-sqlite3`.

```bash
cd backend
nvm install
nvm use
npm ci
```

Only when `.env` does not exist:

```bash
cp .env.example .env
```

Keep existing settings and add missing ones manually:

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

The health endpoint is `http://127.0.0.1:3000/api/health` and returns:

```json
{"status":"ok","service":"invoice-receipt-backend"}
```

Set HOST=0.0.0.0 only when external access is needed, for example in a container.
No Stripe keys are needed for bootstrap or invoice calculations. Member 3 adds
payment-only settings to .env.example when that feature is implemented.

## Available commands

| Command | What it does |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Watch source files and restart |
| `npm run db:init` | Initialize SQLite without deleting existing data |
| `npm run check` | JavaScript syntax checks; not a linter |
| `npm test` | Discover all backend tests with Node's test runner |
| `npm run test:coverage` | Print experimental terminal coverage |

The built-in SQLite experimental warning on Node 22 is expected. Tests use
in-memory or temporary databases and do not need a running server or real API keys.
The terminal coverage summary is not yet an LCOV report imported by SonarQube.
Both backend owners must coordinate one compatible coverage setup.

## Ownership and endpoints

| Endpoint or area | Owner |
| --- | --- |
| `POST /api/invoices` | Member 2 |
| `GET /api/invoices` and `GET /api/invoices/:id` | Member 2 |
| `GET /api/invoices/:id/conversion?currency=USD` | Member 2 |
| `POST /api/invoices/:id/checkout` | Member 3 |
| `POST /api/webhooks/stripe` | Member 3 |
| `GET /api/invoices/:id/receipt` | Member 3 |

These are implementation targets, not a claim that all endpoints already exist.
The supplied scaffold implements health and SQLite initialization. The separate
Commit 1 package adds calculation/validation functions and tests when applied.

Use `invoices/` for Member 2's invoice modules and `exchange-rates/` for their
planned conversion modules. Use `payments/` for Member 3's planned checkout,
webhook and receipt modules. Keep receipt generation there initially to give
Member 3 a clear ownership boundary. Existing files do not need a mass reorganization.

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
- Keep existing Commit 1 tests. Their maintenance transfers to Member 2; do not
  delete them to match a new role assignment.

See [invoice work](invoices/README.md), [payment work](payments/README.md) and
[workflow ownership](../.github/workflows/README.md).
