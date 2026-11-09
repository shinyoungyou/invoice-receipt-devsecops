# Invoice and receipt backend

Minimal runnable bootstrap for Member 1 and Member 3. It provides an Express app,
a health endpoint, JSON errors, SQLite initialization and smoke tests. Invoice API, conversion,
Stripe and PDF features will be added through feature PRs.

## Setup

Use the latest Node.js 22.x release (minimum 22.16; tested on 22.23.4). From the repository root:

```bash
cd backend
nvm install             # installs the Node version in .nvmrc
nvm use
npm ci
cp .env.example .env
npm run db:init
npm run dev
```

The default local address is http://127.0.0.1:3000. Change PORT in .env if needed.
Set HOST=0.0.0.0 only when the environment needs to accept external connections,
for example a container. Environment variables supplied by the shell take priority.
Copy .env.example to .env before starting: the start and dev commands require it.
No Stripe or other API credentials are needed for this scaffold.

```bash
curl http://127.0.0.1:3000/api/health
```

Expected response (HTTP 200):

```json
{"status":"ok","service":"invoice-receipt-backend"}
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run db:init` | Initialize the local SQLite schema without deleting data |
| `npm start` | Start the server without watching files |
| `npm run dev` | Restart automatically after source changes |
| `npm test` | Run smoke tests using Node's test runner |
| `npm run check` | Check JavaScript syntax; this is not a linter |
| `npm run test:coverage` | Print Node's experimental coverage summary |

Tests use an automatically allocated local port, in-memory or temporary databases, and do not require .env or an
already running server. Do not commit .env, node_modules or generated coverage.
Commit package-lock.json so teammates and CI use the same dependency versions.

## Files

- app.js: exports the Express app without opening a port.
- server.js: reads configuration, starts listening and handles shutdown.
- tests/health.test.js: health, unknown-route and malformed-JSON smoke tests.
- .env.example: safe example configuration.
- .nvmrc: shared Node major version for local setup and CI.
- .gitignore: backend-local exclusions.

## Handoff to Member 3

Configure Actions with Node 22 and backend as the working directory, then run:

```bash
npm ci
npm run check
npm test
```

For setup-node dependency caching, use backend/package-lock.json as the cache
path when the workflow runs from the repository root. Coverage currently prints
in the terminal only: Member 3 should configure an LCOV-producing coverage tool
and SonarQube's report path before claiming coverage is imported into SonarQube.
These smoke tests do not yet check invoice or payment rules. Add those tests with
the features; do not add empty placeholder tests that always pass.

## Handoff to Member 1

Add routes before the 404 handler and keep business calculations independently
testable. Mount the Stripe webhook route with express.raw({ type: 'application/json' })
before express.json() so signature verification receives the original bytes.
Keep checkout and receipts in CAD; currency conversion is display-only.

Frontend cross-origin access is not configured in bootstrap. Coordinate a dev
proxy or explicit allowed frontend origin with Member 2 when integrating.

If bootstrap is still in progress, include these files in Commit 2:
`chore: scaffold frontend and backend directories`.
If bootstrap is already shared, add them in a small PR:
`chore: add runnable backend scaffold`.

## References

- Express: https://expressjs.com/en/starter/installing/
- Node CLI and test flags: https://nodejs.org/api/cli.html

## SQLite foundation

The server opens the database on startup and exposes it as `app.locals.db` for
future route handlers. `npm run db:init` also initializes it explicitly, useful
for CI. Repeating initialization preserves data. No seed records are inserted.

The initial schema contains `invoices`, `invoice_items`, and
`processed_webhook_events`. Currency is CAD and status is unpaid or paid.
Amounts use integer cents; timestamps are UTC ISO strings supplied by the app.
Use parameterized statements. Backend validation must still check safe arithmetic,
supported tax rates, text lengths and all business rules.

`DATABASE_PATH` defaults to `./data/invoices.db`, resolved relative to backend/.
An absolute path or `:memory:` also works. If you already have .env, add the new
DATABASE_PATH line manually; do not replace your existing settings.

Schema v1 is recorded with SQLite user_version. Do not edit schema.sql expecting
an existing database to change. Add a versioned migration for later schema edits.
Unknown schema versions fail rather than silently opening an incompatible schema.
Each connection enables foreign keys and uses a busy timeout and WAL mode.

Receipt URLs are derived by the API, not stored. Map SQL snake_case columns to the
camelCase API contract. Later payment logic must atomically mark the invoice paid
and insert the processed event, using a transaction; the event ID primary key
alone does not implement the full webhook workflow.

Member 3 can run these from backend/ in CI:

```bash
npm ci
cp .env.example .env
npm run db:init
npm run check
npm test
```

Tests never use DATABASE_PATH from your environment: they explicitly create their
own in-memory or temporary file databases. Do not commit a generated database.
SQLite uses Node's built-in `node:sqlite` module. There is no external SQLite
npm dependency or native addon installation step. Node 22 may print an
ExperimentalWarning for SQLite; this is a warning, not a failed initialization.
This package targets Node 22.16+ within Node 22, not Node 22.5 or Node 20.
The existing SQLite schema and database files remain compatible.


Bootstrap commit: `chore: initialize SQLite database setup`.
CI workflows, detailed business-rule tests, SonarQube and CodeQL remain Member 3's work.
