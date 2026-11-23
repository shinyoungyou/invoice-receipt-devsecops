# Feature checks and SonarQube

Member 2 maintains the backend checks in `backend-core-ci.yml`. Pull requests
to `main`, pushes to `main` or `feature/backend-invoices`, and manual runs
install the locked dependencies, initialize SQLite, check syntax and run the
backend tests on Node 22.23.4. Each successful run uploads the `backend-lcov`
artifact. Conversion tests use fixture rates.

## Run and view the team scan

Local development and backend tests run independently of SonarQube. To review
coverage, findings or security hotspots, open the shared VM and sign in with
an account that can browse project `invoice`. [Project dashboard](http://44.249.249.194:9000/dashboard?id=invoice)

Once the workflow is on `main`, a push to `main` runs **Backend checks** and
then **SonarQube quality gate**. To request another scan of the same branch,
select **Actions → Backend core CI → Run workflow** and choose `main`. Pull
requests and feature-branch runs skip the SonarQube job. The main-branch job
downloads the backend LCOV artifact, generates the frontend LCOV report itself
(`npm ci --ignore-scripts` and `npm run test:coverage` in `frontend/`),
uploads the analysis to the VM and waits for the gate. A failed gate fails the job. [GitHub Actions](https://github.com/shinyoungyou/invoice-receipt-devsecops/actions)

### Repository settings for Member 2

The repository variable `SONAR_HOST_URL` points to
`http://44.249.249.194:9000`. The VM must be reachable from the GitHub runner.
The repository secret `SONAR_TOKEN` holds a project analysis token scoped to
the case-sensitive key `invoice`. Both entries are configured in **Settings →
Secrets and variables → Actions**. An empty host variable skips the scan.

The token configured on November 18, 2026 expires on **December 18, 2026 at
00:00 UTC** (December 17 at 4 p.m. Pacific). Before expiry, generate a
replacement in SonarQube under **My Account → Security**, choose **Project
Analysis Token** and select `invoice`. Update the GitHub secret, verify a
successful scan on `main`, then revoke the previous token. If the VM moves,
update the repository variable to the new base URL.

### Optional manual scan

A manual scan of the current checkout updates this Community Build project's
shared `main` dashboard, including when the checkout is a feature branch.
Use `git rev-parse HEAD` to identify the revision the team will see. Install
SonarScanner CLI on your PATH and supply `SONAR_HOST_URL` and a separate
`invoice` project analysis token as `SONAR_TOKEN` in your shell environment.
Use a token you can revoke after the scan. [SonarScanner CLI](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/sonarscanner)

In PowerShell, enter your project token at the hidden prompt.

```powershell
$env:SONAR_HOST_URL = 'http://44.249.249.194:9000'
$env:SONAR_TOKEN = [System.Net.NetworkCredential]::new('', (Read-Host 'Project analysis token' -AsSecureString)).Password
```

In Bash, use the equivalent shell settings.

```bash
export SONAR_HOST_URL='http://44.249.249.194:9000'
read -r -s -p 'Project analysis token: ' SONAR_TOKEN
echo
export SONAR_TOKEN
```

From the repository root with Node 22.23.4, run

```sh
npm --prefix backend ci --ignore-scripts
npm --prefix backend run test:coverage
npm --prefix frontend ci --ignore-scripts
npm --prefix frontend run test:coverage
sonar-scanner "-Dsonar.qualitygate.wait=true"
```

On Windows with PowerShell, use `npm.cmd` and `sonar-scanner.bat` for those
commands. The scanner reads the root configuration and imports
`backend/coverage/lcov.info` and `frontend/coverage/lcov.info`. Without the
frontend step, the frontend would be reported as 0% covered. Close the shell and revoke the one-off token
after the scan. Capture
the commit, rule, location and gate result before fixing a finding, then record
the result of the rescan. [Team demo evidence](../../docs/demo-evidence.md)

The scanner uses the single root `sonar-project.properties`. The backend
coverage command includes Member 3's tests in `backend/tests/**/*.test.js`.
The frontend's tests are in `frontend/tests` (marked as test code), its
coverage is imported from `frontend/coverage/lcov.info` with paths relative to
the repository root, and the `frontend/*.config.js` tool files are excluded
from coverage.

Member 1 owns frontend checks and branch protection settings. Member 3 owns
payment checks. SonarQube is the team's only code scanner; the project does not
use CodeQL. Member 1 also compared SonarQube Cloud on a separate demo branch
(`sonar-demo.yml` exists only on `demo/sonar-gate`); it is not part of the
team's checks. See the [team demo evidence](../../docs/demo-evidence.md).

## Payment checks

Member 3 maintains `backend-payments-ci.yml`. Pull requests to `main`, pushes
to `main` or `feature/backend-payments`, and manual runs install the locked
dependencies and then:

1. Fail if a Stripe live key or webhook signing secret is committed.
2. Run `npm audit --omit=dev --audit-level=high` on runtime dependencies.
3. Check syntax, run the checkout, webhook and receipt tests with a readable
   report, then run the full backend suite.

Stripe is mocked and webhook signatures use a synthetic secret, so the job needs
no repository secrets. See the [payment guide](../../backend/payments/README.md).

## Frontend checks

Member 1 maintains `frontend-ci.yml`. Pull requests to `main`, pushes to
`main` or `feature/frontend`, and manual runs use Node 22.23.4 in `frontend/`.
The job runs, in order:

1. `npm ci --ignore-scripts`. Dependency install scripts never run in CI.
2. `npm audit --audit-level=high`.
3. `npm run lint`.
4. `npm run test:coverage`. Every test must pass.
5. `npm run build`.

It then uploads `frontend/coverage/lcov.info` as the `frontend-lcov`
artifact. The tests use a fake `fetch`, so the job needs no backend and no
secrets. See the [frontend guide](../../frontend/README.md).

## Required checks on `main`

Member 1 configures branch protection for `main` under **Settings → Rules →
Rulesets → New branch ruleset**. Use **Target branches → Include default
branch**, then enable these settings:

| Setting | Value |
| --- | --- |
| Restrict deletions | On |
| Block force pushes | On |
| Require a pull request before merging | On, with **1** required approval |
| Require status checks to pass | On, with the checks below |

| Required check | Workflow | Owner |
| --- | --- | --- |
| **Backend checks** | `backend-core-ci.yml` | Member 2 |
| **Payment checks** | `backend-payments-ci.yml` | Member 3 |
| **Frontend checks** | `frontend-ci.yml` | Member 1 |

All three workflows run on every pull request to `main`, with no path
filters. A required check therefore never waits forever on a pull request that
only touches one area. The check names must match the job names exactly. They
appear in the ruleset's search box after each workflow has run once.

**SonarQube quality gate** cannot be a required check on pull requests,
because it runs only after a push to `main`. Its result is reviewed after each
merge. A red gate is fixed in a follow-up pull request before the next
release.

## Release and demo steps

1. **Merge every feature through a pull request.** Each one needs its required checks green and one approval.
2. **Confirm `main` is green.** On the latest commit to `main`, check that all three feature checks and **SonarQube quality gate** passed in **Actions**. Record the run link in the [team demo evidence](../../docs/demo-evidence.md).
3. **Tag the release from that commit.**

   ```sh
   git switch main
   git pull
   git tag -a v1.0.0 -m "Invoice and Receipt Generator: final demo release"
   git push origin v1.0.0
   ```

   Then create a GitHub release from the tag under **Releases → Draft a new release**.
4. **Prepare the demo machine** from the tag:
   - Node 22.23.4.
   - `backend/.env` with Stripe **test** keys and the `whsec_…` secret from `stripe listen`. Never commit them.
   - Three terminals: `stripe listen`, then `npm run dev` in `backend/`, then `npm run dev` in `frontend/`.
   - Check `http://127.0.0.1:3000/api/health`, then `http://localhost:5173`.
5. **Rehearse once and keep a backup recording** of the full journey, following the [end-to-end rehearsal](../../docs/demo-evidence.md#end-to-end-rehearsal).
6. **Check credentials before the presentation.** The SonarQube token expires on December 17 at 4 p.m. Pacific, as noted above. Stripe test keys stay on the demo machine.

