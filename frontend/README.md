# Frontend

Owner: **Member 1**. Branch: `feature/frontend`.
Member 1 owns the frontend, its tests and its CI, and wired frontend coverage
into the team's SonarQube quality gate.

The frontend is plain HTML, Tailwind CSS and JavaScript. Vite runs the dev
server and builds it; Vitest runs the tests. There is no UI framework.

## Setup

Use Node.js 22.23.4, the same version as CI and the backend. With nvm, run
`nvm install 22.23.4` and `nvm use 22.23.4`; `frontend/.nvmrc` pins the same
version.

The frontend needs the backend running. Start it first, following the
[backend setup](../backend/README.md#setup), in its own terminal:

```bash
cd backend
npm run dev
```

Then, in a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

The Vite dev server is fixed to port 5173, because the backend's default
Stripe return URLs point there. It forwards every `/api` request to the
backend at `http://127.0.0.1:3000`, so the browser makes same-origin requests
and no CORS setup is needed.

## Commands

Run these inside `frontend/`.

| Command | What it does |
| --- | --- |
| `npm ci` | Installs the exact versions in `package-lock.json` |
| `npm run dev` | Starts the dev server at `http://localhost:5173` with the `/api` proxy |
| `npm run build` | Builds the production bundle into `dist/` |
| `npm run preview` | Serves the built bundle locally |
| `npm test` | Runs all tests once (non-interactive, as in CI) |
| `npm run test:coverage` | Runs the tests and writes `coverage/lcov.info` for SonarQube |
| `npm run lint` | Runs ESLint |

## Pages

| URL | Page |
| --- | --- |
| `/` | Invoice list with search. The search text is kept in `?q=`, so reload and Back work |
| `/invoices/new` | Create-invoice form |
| `/invoices/{id}` | Invoice detail: items, server totals, USD estimate, payment and receipt |
| `/invoices/{id}?checkout=success` or `?checkout=cancelled` | Where Stripe sends the browser back after checkout |

## How it works

| Area | Behavior |
| --- | --- |
| Money | Prices are typed in dollars and sent as **integer cents**, converted by splitting the text, never by `price * 100`, which loses a cent for values like `1.15`. Totals and tax always come from the server |
| Validation | Each field shows its own error, both for the browser's checks and for server errors that name a `field`. The first invalid field gets focus |
| USD estimate | Loaded separately, after the invoice. It is labelled "Estimated USD equivalent — charged in CAD" with the Bank of Canada rate and date. If the rate service fails, the invoice stays usable in CAD |
| Checkout | The **Pay** button asks the backend for a Stripe Checkout session and sends no amount. After Stripe redirects back, the page re-reads the invoice every 2 seconds, up to 15 times, until the **webhook** has marked it paid. A `?checkout=success` URL is never treated as payment |
| Receipt | **Download receipt (PDF)** appears only when the invoice is paid and the server has set `receiptUrl`. A rejected request (`409 INVOICE_NOT_PAID`) shows a message instead of a broken file |
| States | Every page has loading, empty, error-with-retry and not-found states. An unexpected bug shows a message instead of a stuck "Loading…" |
| Accessibility | Labelled inputs, errors linked with `aria-describedby`, focus moves to the new heading on navigation, keyboard-usable controls |

## Security measures

| Risk | Protection | Where |
| --- | --- | --- |
| Cross-site scripting (XSS) | All server and user text is inserted with `textContent`, never `innerHTML` | `src/dom.js` |
| Client-side path traversal (CSPT) | Invoice IDs must match `[A-Za-z0-9_-]{1,100}` before they are used in an API path. Every request URL must also stay on the same origin under `/api/`. Found by SonarQube Cloud as `jssecurity:S8476` | `src/api.js` |
| Open redirect to a fake payment page | Only `https://checkout.stripe.com` URLs are opened for checkout | `src/external.js` |
| Client-chosen amounts | Checkout sends no body; the server charges its stored CAD total | `src/api.js` |
| Unsafe download names | The receipt file name from the server is reduced to letters, digits, `.`, `_` and `-` | `src/api.js` |
| Dependency install scripts in CI | CI installs with `npm ci --ignore-scripts`. Found by SonarQube Cloud as `githubactions:S6505` | `.github/workflows/frontend-ci.yml` |
| Secrets | The frontend holds no keys. Stripe and SonarQube credentials stay on the server or in CI secrets | — |

## Project layout

```text
frontend/
├── index.html            Page shell
├── src/
│   ├── main.js           Routing between pages, error safety net
│   ├── router.js         URL matching and in-app links (History API)
│   ├── api.js            All backend requests and error handling
│   ├── money.js          Cents parsing and CAD/USD formatting
│   ├── dom.js            Safe element builder (no innerHTML)
│   ├── external.js       Stripe redirect allowlist, file download
│   └── views/            One module per page or page section
└── tests/                Vitest tests (jsdom), one file per module
```

## Tests

`npm test` runs about 200 tests in under 3 seconds, with line coverage at
100%. They use a fake `fetch`, so no backend is needed. They cover the
following:

- **Form:** valid submission, every invalid-input case, server field errors, and that `$1.15` is sent as exactly 115 cents
- **Money:** every price from `$0.00` to `$99.99` converts exactly
- **Pages:** list and search, detail, not-found and error states, and that leaving a page cancels its requests
- **USD estimate:** displayed, unavailable (503), retried, and dated without a time-zone shift
- **Payment:** checkout start, the Stripe-only redirect, pending polling with fake timers, and that a success redirect alone never marks an invoice paid
- **Receipt:** only for paid invoices, plus a rejected request
- **Security:** hostile invoice IDs, hostile search text, paths that would leave `/api/`, a non-Stripe redirect, and HTML in every displayed field

## CI and SonarQube

**Frontend CI** (`.github/workflows/frontend-ci.yml`, job **Frontend checks**)
runs on pushes to `main` and `feature/frontend` and on pull requests to
`main`. It runs, in order:

1. `npm ci --ignore-scripts`
2. `npm audit --audit-level=high`
3. lint
4. tests with coverage
5. build

It then uploads `frontend/coverage/lcov.info`.

For **SonarQube**:

- `sonar-project.properties` treats `frontend/tests` as test code, imports `frontend/coverage/lcov.info`, and excludes the `*.config.js` tool files from coverage.
- Coverage paths are written relative to the repository root (`frontend/src/...`), matching the backend report.
- On `main`, the **SonarQube quality gate** job in `backend-core-ci.yml` generates frontend coverage itself, right before the scan, so the gate never sees a missing or stale report.

Member 1's findings, fixes and gate results are recorded in
[docs/demo-evidence.md](../docs/demo-evidence.md).

## Known limitations

- The app runs locally only; there is no deployed environment.
- Paying requires Stripe test keys in `backend/.env` and webhook forwarding with the Stripe CLI; see the [payments setup](../backend/payments/README.md). Without them, **Pay** shows "Payments are not configured on this server."
- There is no automated browser end-to-end test. The full journey (invoice, USD estimate, test checkout, verified paid, PDF receipt) is checked in a manual rehearsal, recorded in the demo evidence.
