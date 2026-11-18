
# Git Branching Strategy

## Repository

Name: invoice-receipt-devsecops

## Main Branch

`main` is the stable integration branch.

Member 1 creates the repository and completes
the first three setup commits on main.

After initial setup:
- Do not push feature changes directly to main.
- Use pull requests to merge changes.
- Review changes before merging.
- Run automated checks before merging.

## Branch Ownership

| Member | Branch | Scope |
| --- | --- | --- |
| 1 | `feature/frontend` | UI, frontend tests and CI |
| 2 | `feature/backend-invoices` | Invoice and currency APIs, backend-core CI and shared SonarQube configuration |
| 3 | `feature/backend-payments` | Checkout, webhooks, receipts, payment CI and shared CodeQL configuration |

## Development dependencies

Member 2's invoice and conversion APIs are available on `feature/backend-invoices`.
Members 1 and 3 can exercise the API on that branch and use its contract and
fixtures on their own branches until it merges. All three members verify the
integrated application. See the [team handoff](../README.md#member-2-handoff).

## Pull Request Workflow

1. Work in your assigned feature branch.
2. Commit changes with descriptive messages.
3. Push your branch to GitHub.
4. Open a pull request targeting main.
5. Request review from another member.
6. Resolve conflicts and address feedback.
7. Merge after required checks pass.

Use smaller pull requests when practical.

## Commit Message Convention

Use conventional commit prefixes:

- feat: new functionality
- fix: bug fix
- test: automated tests
- docs: documentation
- chore: setup or maintenance
- ci: CI/CD configuration
- refactor: code restructuring

Examples:

feat: implement invoice creation endpoint

feat: add invoice creation form

test: verify invoice tax calculations

ci: add GitHub Actions test workflow

chore: configure SonarQube analysis

## Security Rules

- Never commit API keys or passwords.
- Store local configuration in .env files.
- Commit only placeholder values in .env.example.
- Use Stripe test mode.
- Do not commit real customer payment data.
- Do not merge deliberately vulnerable demo code
  into the stable main branch.

## Branch checks

Pull requests to `main` run backend checks. After merge, the workflow on
`main` also submits the project to SonarQube Community Build and waits for
the quality gate. A manual scan of a feature checkout appears on the same
SonarQube `main` dashboard. Use the analysis revision to identify the code
that was scanned. See the [CI and scanner guide](../.github/workflows/README.md).

## Merge Conflict Prevention

- Each member maintains the tests and CI checks for their feature area.
- Discuss changes to shared files before editing.
- Synchronize branches regularly with main.
- Do not force-push shared branches without agreement.

## Definition of Done

A task is complete when:
- The implementation meets the agreed API contract.
- Relevant automated tests pass.
- Applicable static analysis checks are reviewed.
- No secrets are committed.
- The pull request is reviewed and merged.
- Documentation is updated when necessary.
