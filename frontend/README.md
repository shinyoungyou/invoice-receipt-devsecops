# Frontend

Owner: **Member 1**. Branch: `feature/frontend`.
Member 1 owns frontend implementation, frontend tests and frontend CI.

## Feature responsibilities

- Build invoice creation, list/search and detail screens.
- Include seller/customer names, descriptions, quantities, prices and supported
  demo tax rates. Convert displayed prices to integer-cent request values without
  trusting browser totals on the backend.
- Show server-calculated CAD totals and clear unpaid/paid status.
- Add the dated USD estimate from Member 2's conversion endpoint; label CAD as the
  checkout currency. Rate-service failure must not block CAD invoice/payment use.
- Open Member 3's Stripe test checkout URL. On return, fetch invoice status from
  the backend. Handle pending payment; never mark paid from a URL parameter.
- Offer PDF download only when the backend says the invoice is paid, and handle
  a rejected receipt request.
- Include validation messages, loading/empty/error states and keyboard-accessible
  forms with labels.

## Dependencies and handoffs

Start with mocks from the agreed `docs/api-contract.md` and sample JSON.
Member 2 provides invoice and conversion responses; Member 3 provides checkout,
payment-state and receipt behavior. Do not invent incompatible field names.
The sample invoice response includes server-owned fields; construct a create
request containing only accepted input fields.

Connect the real invoice UI after Member 2's create/list/detail PR merges.
Integrate payment after Member 3 publishes the checkout and webhook contract.
Coordinate a frontend development proxy or explicit allowed origin with Member 2.

## Frontend setup status

Use Node 22.23.4 consistently with the backend and CI. A frontend structure scaffold was not
included in the supplied backend packages. These README changes do not add one.
Member 1 should scaffold the frontend structure, commit its package.json and lockfile, and establish
these commands before configuring required CI checks:

| Planned command inside frontend/ | Responsibility |
| --- | --- |
| `npm ci` | Reproducible installation after the lockfile exists |
| `npm run dev` | Local frontend development |
| `npm run build` | Production build validation |
| `npm test` | Non-interactive UI tests for CI |
| `npm run lint` | Linting once configured |

Document the actual frontend URL and backend base URL after scaffolding. Do not
put server-side Stripe or scan secrets in frontend environment variables.

## Tests and DevOps owned by Member 1

Test valid submission, invalid input, server error display, invoice list/search,
CAD formatting, currency unavailability, pending/paid return states and receipt
availability. Mock API responses for component tests and join both backend owners
for an end-to-end rehearsal.

Create and maintain `frontend-ci.yml` with install, lint, UI tests and build after
those scripts exist. Produce coverage in the shared report format and coordinate
its import with the SonarQube coordinator. Fix frontend scanner findings yourself.
Member 1 coordinates repository required checks and a final release/demo workflow;
Members 2 and 3 supply their own passing checks.

## Done when

The UI runs against real APIs, its tests/build pass in CI, and the invoice → USD
estimate → test checkout → verified paid receipt journey is demonstrated. Supply
screenshots or a backup recording and explain the frontend checks you implemented.
