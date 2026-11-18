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

`main` supplies Member 2's invoice creation, list/search, detail and dated USD
estimates. Follow the [backend setup and invoice walkthrough](../backend/README.md)
to run the backend locally. The default API base is `http://127.0.0.1:3000/api`.
When scaffolding the UI, proxy `/api` from its dev server to
`http://127.0.0.1:3000` so the browser can use same-origin requests.

Use the [create request](../docs/api-contract.md#create-an-invoice) for
`POST /api/invoices` and the [sample responses](../docs/sample-invoice.json)
for UI fixtures. A successful create returns the full unpaid invoice and
its detail URL in `Location`. Use `GET /api/invoices?q=…` for summaries and
fetch detail for the ordered items. Request the USD estimate separately so a
rate-service error leaves the CAD invoice usable.

Member 3's checkout and PDF receipt endpoints are on `main`.
The [payments contract](../docs/api-contract.md#payments-and-receipts) has the
checkout response and error codes. After checkout returns, fetch invoice detail
to get the verified status and receipt URL. Set `CHECKOUT_SUCCESS_URL` and
`CHECKOUT_CANCEL_URL` in `backend/.env` to the UI's invoice route; they default
to `http://localhost:5173/invoices/{INVOICE_ID}?checkout=success|cancelled`.

## Frontend setup status

This branch contains the frontend plan. Member 1 will scaffold the UI on
Node 22.23.4 and commit its package.json and lockfile. The planned commands
below become available with that scaffold.

| Planned command inside frontend/ | Responsibility |
| --- | --- |
| `npm ci` | Reproducible installation after the lockfile exists |
| `npm run dev` | Local frontend development |
| `npm run build` | Production build validation |
| `npm test` | Non-interactive UI tests for CI |
| `npm run lint` | Linting once configured |

Document the frontend URL and any proxy settings after scaffolding. Keep
Stripe and SonarQube credentials on the server or in CI.

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
