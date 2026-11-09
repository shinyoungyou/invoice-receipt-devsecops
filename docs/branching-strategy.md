
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

### Member 1 — Backend

Branch: feature/backend

Responsibilities:
- Node.js and Express backend
- Database integration
- Invoice REST APIs
- Server-side invoice calculations
- Stripe test-mode integration
- Webhook verification
- PDF receipt generation

Primary directory: backend/

### Member 2 — Frontend

Branch: feature/frontend

Responsibilities:
- Frontend application
- Invoice creation form
- Invoice details and totals
- Payment link interface
- Payment status display
- Receipt download interface
- Frontend validation and error messages

Primary directory: frontend/

### Member 3 — DevSecOps

Branch: feature/devsecops

Responsibilities:
- SonarQube configuration
- GitHub Actions CI workflow
- Static code analysis
- Code quality gate integration
- Automated test execution
- Security demonstration
- CI/CD documentation

Primary directories:
- .github/workflows/
- docs/
- SonarQube configuration files

## Development Dependencies

### Step 1 — Initial Setup

Member 1:
- Create repository.
- Create shared directory structure.
- Define initial API contract.
- Push all three setup commits to main.

### Step 2 — Parallel Development

Member 1:
- Develop backend APIs and database logic.

Member 2:
- Develop frontend using mock API responses
  based on docs/api-contract.md.

Member 3:
- Configure GitHub Actions.
- Configure SonarQube.
- Set up automated checks using sample code.

Members 2 and 3 do not need to wait for
the backend implementation to finish.

### Step 3 — Integration

- Member 1 completes required backend endpoints.
- Member 2 connects frontend to backend.
- Member 3 integrates test and analysis workflows.
- All members verify the complete application.

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

## SonarQube Free-Tier Considerations

SonarQube Community Build supports main-branch
analysis but does not provide the full pull-request
analysis capabilities of paid editions.

GitHub Actions can run automated tests on pull
requests independently of SonarQube.

The team should confirm the exact SonarQube edition
and configure its quality gate accordingly.

## Merge Conflict Prevention

- Member 1 primarily edits backend/.
- Member 2 primarily edits frontend/.
- Member 3 primarily edits CI/CD configuration.
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
