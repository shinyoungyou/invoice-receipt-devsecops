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
downloads the backend LCOV artifact, uploads the analysis to the VM and waits
for the gate. A failed gate fails the job. [GitHub Actions](https://github.com/shinyoungyou/invoice-receipt-devsecops/actions)

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
npm --prefix backend ci
npm --prefix backend run test:coverage
sonar-scanner "-Dsonar.qualitygate.wait=true"
```

On Windows with PowerShell, use `npm.cmd` and `sonar-scanner.bat` for those
commands. The scanner reads the root configuration and imports
`backend/coverage/lcov.info`. Close the shell and revoke the one-off token
after the scan. Capture
the commit, rule, location and gate result before fixing a finding, then record
the result of the rescan. [Team demo evidence](../../docs/demo-evidence.md)

The scanner uses the single root `sonar-project.properties`. The backend
coverage command includes Member 3's tests in `backend/tests/**/*.test.js`.
When the frontend suite exists, Member 1 can upload its LCOV report and add
its path and test directories to the shared analysis.

Member 1 owns frontend checks and branch protection settings. Member 3 owns
payment checks. SonarQube is the team's only code scanner; the project does not
use CodeQL.

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
