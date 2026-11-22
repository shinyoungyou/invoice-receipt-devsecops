# Invoice and Receipt Generator

A team DevSecOps project for creating CAD invoices, estimating their USD value
and issuing PDF receipts after verified Stripe test payments. The shared Node.js,
Express and SQLite backend implements invoice creation, search, details,
currency estimates, Stripe test checkout, verified webhooks and PDF receipts.
A plain HTML, Tailwind CSS and JavaScript frontend (built with Vite) covers the
whole journey; see the [frontend README](frontend/README.md) to run it.

## Run the backend

The invoice and payment backends are both on `main`.

```sh
git clone https://github.com/shinyoungyou/invoice-receipt-devsecops.git
cd invoice-receipt-devsecops
```

Use Node.js 22.23.4 and follow the [backend setup and test request](backend/README.md).
The API listens at `http://127.0.0.1:3000/api` by default. Local setup and
tests run independently of Stripe and SonarQube. To take a live test-mode
payment, follow the [payment setup](backend/payments/README.md#run-payments-locally-in-stripe-test-mode). The live USD estimate uses the
Bank of Canada service.

## Feature ownership

Each member implements, tests and maintains CI checks for their own feature area.

| Member | Feature ownership | Tests and DevOps | Primary branch |
| --- | --- | --- | --- |
| Member 1 | Frontend: invoice form, list/search, details, currency display, checkout return and receipt download | UI tests, frontend build/checks, frontend CI and deployment configuration if used | `feature/frontend` |
| Member 2 | Backend 1: input validation, totals, invoice persistence/create/list/detail/search and exchange-rate API | Calculation, validation, database and conversion tests; backend-core CI | `feature/backend-invoices` |
| Member 3 | Backend 2: Stripe checkout, verified webhooks, payment state and paid PDF receipts | Payment, webhook and receipt tests; payment CI | `feature/backend-payments` |

Members 2 and 3 share one Express server, one package.json and one SQLite schema.

## Member 2 handoff

| Who | What is ready and what comes next |
| --- | --- |
| Member 1 | Use the invoice and conversion endpoints for the form, list/search and detail screens. The create request and full response examples are in the [API contract](docs/api-contract.md). The frontend is implemented and connected to these endpoints; see the [frontend README](frontend/README.md). |
| Member 3 | Use `getInvoice(db, id)` to read the stored CAD amount and current payment state. Build checkout, webhook handling and receipts against the same records. See the [payment handoff](backend/payments/README.md). |
| Member 2 | Invoice validation, tax calculations, SQLite persistence, reads/search, USD conversion, tests, backend CI and SonarQube setup are implemented on this branch. The first manual scan is recorded. The open finding still needs review and the team still needs the post-merge CI scan and joint integration rehearsal. See the [invoice implementation](backend/invoices/README.md) and [demo evidence](docs/demo-evidence.md). |

## Member 3 handoff

| Who | What is ready and what comes next |
| --- | --- |
| Member 1 | Checkout, webhook and receipt endpoints are on `main`. Call checkout, send the browser to `checkoutUrl`, then refetch invoice detail on return and show a pending state until it is `paid`. Use `receiptUrl` to download the PDF. See [payments and receipts](docs/api-contract.md#payments-and-receipts). |
| Member 2 | Please review the shared-file changes now on `main`: the webhook mount before `express.json()` and the payment router in `backend/app.js`, plus the `stripe` and `pdfkit` dependencies. No schema change was needed. |
| Member 3 | Checkout, verified webhooks, payment state, PDF receipts, payment tests and payment CI are merged to `main`. Still to do: the live Stripe test-mode rehearsal with the UI, a SonarQube finding review for payment code and the payment demo evidence. See the [payment guide](backend/payments/README.md). |

## Scope and money rules

- Store invoices, tax, Stripe checkout amounts and receipts in CAD integer cents.
- Offer a Bank of Canada CAD-to-USD display estimate with its rate date. Label it
  “Estimated USD equivalent — charged in CAD.” The charge remains CAD.
- Use fictional restaurant, donair and retail data and Stripe test mode only.
- Current calculation code accepts 0% or 5% demo tax; expand supported rates only
  through an agreed contract change. Round tax half up once on the subtotal.
- The backend owns totals, payment status and receipt eligibility.
- A browser success redirect is not proof of payment.

## Integration and branches

The invoice and payment backends are merged to `main`. Member 1's
`feature/frontend` connects the UI to the real endpoints and merges through one
pull request; the team rehearses the invoice-to-paid-receipt flow together. Use small pull requests into
`main`, one teammate review and passing checks. See the [branching strategy](docs/branching-strategy.md).

## Shared files and security scanning

| Shared area | Coordinator | Review and contribution |
| --- | --- | --- |
| `backend/app.js`, `server.js`, package files and database migrations | Member 2 | Member 3 reviews backend integration and contributes payment changes |
| `docs/api-contract.md` | Member 2 maintains the document | M2 owns invoice/conversion sections; M3 owns payment/receipt sections; M1 reviews UI impact |
| Repository-wide SonarQube setup | Member 2 | All members configure relevant coverage, fix their own findings and explain results. Member 3 reviews payment-code findings. |
| Required checks and final release/demo workflow | Member 1 coordinates repository settings | Each member supplies and maintains their feature checks |

SonarQube is the team's only code scanner; the project does not use CodeQL.
The team uses the existing SonarQube project `invoice`. Backend checks run on
feature pushes to `feature/backend-invoices` and pull requests to `main`.
Payment checks run on pushes to `feature/backend-payments` and pull requests
to `main`. Both suites feed the same backend coverage report.
The hosted SonarQube job runs on `main` after backend checks pass. To view
findings, reproduce a scan or maintain the repository credentials, see the
[SonarQube dashboard](http://44.249.249.194:9000/dashboard?id=invoice) and
[CI and scanner guide](.github/workflows/README.md).

## Completion criteria

A teammate can clone, initialize the database, run checks, create and search an
invoice, view a dated currency estimate, pay in Stripe test mode and download a
verified paid CAD receipt. All three members demonstrate their feature, tests,
CI results and a fix or relevant security review. Rehearse one confirmed
SonarQube finding and fix and one failed-to-passing automated check.

Never commit `.env`, tokens, Stripe secrets, actual customer data, generated SQLite
databases, node_modules or generated receipts.


## Record evidence for the final presentation

Each member must record useful examples from their own feature as they work:
failed tests, CI failures, and SonarQube issues or quality-gate failures. Capture the original result before fixing it, then save the change and
the rerun result. Do not rely on remembering the issue at presentation time.

For each example, record:

- Date, member and affected feature.
- Test name or SonarQube rule ID, with the reported message and severity if available.
- A screenshot or short log excerpt, plus the relevant commit, PR or CI/scan link.
- What caused the result and why it mattered to correctness, security or maintainability.
- What changed to fix it, with a commit or PR link.
- The passing rerun or resolved finding, and what the team learned.

Keep notes and evidence links in `docs/demo-evidence.md`. Each member should bring
at least one meaningful before-and-after example from their work; it can be a
test failure or a relevant SonarQube finding. The team also needs the planned
SonarQube demonstration. Not every warning is a vulnerability: explain
whether it was a bug, security concern, quality issue, configuration problem or
false positive. If a finding is not fixed, record the review decision and reason
instead of presenting it as resolved. Remove secrets and personal data from
captured evidence. Do not introduce bugs into main just to create a demo example.
