# Invoice and receipt backend

Minimal runnable bootstrap for Member 1 and Member 3. It provides an Express app,
a health endpoint, JSON errors and smoke tests. Invoice, database, conversion,
Stripe and PDF features will be added through feature PRs.

## Setup

Use Node.js 20.6 or newer within Node 20 (your Node.js 20.20.2 works). From the repository root:

```bash
cd backend
nvm use                 # optional, if nvm is installed
npm ci
cp .env.example .env
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
| `npm start` | Start the server without watching files |
| `npm run dev` | Restart automatically after source changes |
| `npm test` | Run smoke tests using Node's test runner |
| `npm run check` | Check JavaScript syntax; this is not a linter |
| `npm run test:coverage` | Print Node's experimental coverage summary |

Tests use an automatically allocated local port and do not require .env or an
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

Configure Actions with Node 20 and backend as the working directory, then run:

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
