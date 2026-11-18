# Invoice and Receipt Generator

A team DevSecOps project using a frontend, a Node.js/Express backend and
SQLite. The application will create invoices, display tax and currency estimates,
open Stripe test checkout and generate PDF receipts after verified payment.
SonarQube, CodeQL and automated tests support the development workflow.

## Revised division of work

Each member implements, tests and maintains CI checks for their own feature area.
There is no separate member responsible for everybody else's DevOps or tests.
This division replaces the previous frontend/backend/dedicated-DevSecOps split.

| Member | Feature ownership | Tests and DevOps | Primary branch |
| --- | --- | --- | --- |
| Member 1 | Frontend: invoice form, list/search, details, currency display, checkout return and receipt download | UI tests, frontend build/checks, frontend CI and deployment configuration if used | `feature/frontend` |
| Member 2 | Backend 1: input validation, totals, invoice persistence/create/list/detail/search and exchange-rate API | Calculation, validation, database and conversion tests; backend-core CI | `feature/backend-invoices` |
| Member 3 | Backend 2: Stripe checkout, verified webhooks, payment state and paid PDF receipts | Payment, webhook and receipt tests; payment CI | `feature/backend-payments` |

Backend 1 and Backend 2 are ownership areas inside the SAME backend application.
They share one Express server, one package.json and one SQLite database schema.
Do not create separate servers, databases or duplicate invoice models.

## Scope and money rules

- Store invoices, tax, Stripe checkout amounts and receipts in CAD integer cents.
- Offer a Bank of Canada CAD-to-USD display estimate with its rate date. Label it
  “Estimated USD equivalent — charged in CAD.” The charge remains CAD.
- Use fictional restaurant, donair and retail data and Stripe test mode only.
- Current calculation code accepts 0% or 5% demo tax; expand supported rates only
  through an agreed contract change. Round tax half up once on the subtotal.
- The backend owns totals, payment status and receipt eligibility.
- A browser success redirect is not proof of payment.

## Runtime and backend setup

Use Node.js 22.x, minimum 22.16; the supplied backend was tested on 22.23.4.
It uses built-in `node:sqlite`, not `better-sqlite3`. The SQLite experimental
warning on Node 22 is expected and is not an initialization failure.

```bash
cd backend
nvm install
nvm use
npm ci
```

For first-time setup only, copy `.env.example` to `.env`. Preserve existing values
if you already have `.env`; add missing entries manually.

```bash
cp .env.example .env
npm run db:init
npm run check
npm test
npm run dev
```

Default health endpoint: `http://127.0.0.1:3000/api/health`.
See [backend setup](backend/README.md) and [frontend work](frontend/README.md).
The frontend README identifies commands that Member 1 still needs to establish.

## Start in parallel

1. Member 2 publishes the invoice request/response and error shapes. Members 1 and
   3 review them before writing integration code.
2. Member 1 builds screens with mocks. Member 2 develops the invoice API. Member 3
   defines checkout/webhook/receipt interfaces and develops with invoice fixtures.
3. Merge invoice create/list/detail early. Member 1 replaces mocks and Member 3
   connects payment logic to the shared invoice records.
4. Member 2 adds currency conversion; Member 1 integrates its display. Member 3
   completes checkout, webhook and receipts; Member 1 integrates those flows.
5. Each member runs their feature tests, fixes their scan findings and brings
   evidence to a joint end-to-end rehearsal.

## Existing work and branches

The shared bootstrap supplies the Express server and SQLite schema. Member 2's
`feature/backend-invoices` branch adds validation, totals, the invoice and
conversion APIs, their tests and backend CI. See the [API contract](docs/api-contract.md)
for request and response examples.

Once shared foundation work is merged:

```bash
git switch main
git pull --ff-only origin main
# Use only the branch assigned to you:
git switch -c feature/frontend
# Member 2: feature/backend-invoices
# Member 3: feature/backend-payments
```

Use small PRs into main, one teammate review and configured passing checks.
After merging a PR, branch from updated main for the next task. Do not continue
feature development directly on main.

## Shared files and security scanning

| Shared area | Coordinator | Review and contribution |
| --- | --- | --- |
| `backend/app.js`, `server.js`, package files and database migrations | Member 2 | Member 3 reviews backend integration and contributes payment changes |
| `docs/api-contract.md` | Member 2 maintains the document | M2 owns invoice/conversion sections; M3 owns payment/receipt sections; M1 reviews UI impact |
| Repository-wide SonarQube setup | Member 2 | All members configure relevant coverage, fix their own findings and explain results |
| Repository-wide CodeQL setup | Member 3 | All members review relevant alerts and fix their own findings |
| Required checks and final release/demo workflow | Member 1 coordinates repository settings | Each member supplies and maintains their feature checks |

Coordinators prevent duplicate global configurations; they do not take over other
members' feature tests or CI. Agree on shared-file edits before making them.
Both scanners remain project deliverables. See [workflow ownership](.github/workflows/README.md).

## Completion criteria

A teammate can clone, initialize the database, run checks, create and search an
invoice, view a dated currency estimate, pay in Stripe test mode and download a
verified paid CAD receipt. All three members demonstrate their feature, tests,
CI results and a fix or relevant security review. Rehearse one confirmed finding
and fix for each scanner and one failed-to-passing automated check.

Never commit `.env`, tokens, Stripe secrets, actual customer data, generated SQLite
databases, node_modules or generated receipts.


## Record evidence for the final presentation

Each member must record useful examples from their own feature as they work:
failed tests, CI failures, SonarQube issues or quality-gate failures, and CodeQL
alerts. Capture the original result before fixing it, then save the change and
the rerun result. Do not rely on remembering the issue at presentation time.

For each example, record:

- Date, member and affected feature.
- Test name or scanner rule/query ID, with the reported message and severity if available.
- A screenshot or short log excerpt, plus the relevant commit, PR or CI/scan link.
- What caused the result and why it mattered to correctness, security or maintainability.
- What changed to fix it, with a commit or PR link.
- The passing rerun or resolved finding, and what the team learned.

Keep notes and evidence links in `docs/demo-evidence.md`. Each member should bring
at least one meaningful before-and-after example from their work; it can be a
test failure or a relevant scanner finding. The team also needs the planned
SonarQube and CodeQL demonstrations. Not every warning is a vulnerability: explain
whether it was a bug, security concern, quality issue, configuration problem or
false positive. If a finding is not fixed, record the review decision and reason
instead of presenting it as resolved. Remove secrets and personal data from
captured evidence. Do not introduce bugs into main just to create a demo example.
