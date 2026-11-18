# Feature checks and SonarQube

Member 2 maintains the backend checks in `backend-core-ci.yml`. Pull requests
to `main`, pushes to `main` or `feature/backend-invoices`, and manual runs
install the locked dependencies, initialize SQLite, check syntax and run the
backend tests on Node 22.23.4. Each successful run uploads the `backend-lcov`
artifact. Conversion tests use fixture rates.

## Connect the team SonarQube Server

1. Open project `invoice` on the team's SonarQube VM and confirm
   its main branch is `main`. The project key is case-sensitive.
2. Create a project analysis token scoped to `invoice`. In GitHub Actions
   settings, save it as the repository secret `SONAR_TOKEN`. Set the repository
   variable `SONAR_HOST_URL` to the VM's base URL, including its scheme and
   port. The current VM serves HTTP on port 9000.
3. Run **Backend core CI** on `main` after the workflow is merged. The
   SonarQube job uses the backend job's LCOV artifact and waits for the server's
   quality gate. A failed gate fails the job. With no host configured, GitHub
   skips the scan and the backend checks still run.
4. Open the project analysis and inspect the imported coverage and issues. For
   the team demo, record an actual issue's rule, location, impact and analysis
   link before addressing it. Save its status and the gate result on the rescan
   in `docs/demo-evidence.md`.

The scanner uses the single root `sonar-project.properties`. The backend
coverage command includes Member 3's tests in `backend/tests/**/*.test.js`.
When the frontend suite exists, Member 1 can upload its LCOV report and add
its path and test directories to the shared analysis.

Member 1 owns frontend checks and branch protection settings. Member 3 owns
payment checks and the repository CodeQL workflow.
