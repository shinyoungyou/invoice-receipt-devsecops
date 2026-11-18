# Member 2 demo evidence

## Invoice creation from HTTP request through SQLite

On November 18, 2026, the Node 22.23.4 integration test
`creating an invoice returns 201 and stores the calculated unpaid total` ran
against the production Express routes and an isolated SQLite database.

| Stage | Observed result |
| --- | --- |
| Before | With application code at `f09441d` and the new test in the working tree, `POST /api/invoices` reached the fallback route. The assertion reported `404 !== 201`. |
| Change | Commit `21f4480` registered the create route, validated input and persisted the invoice and items in one transaction. |
| After | On `21f4480`, `node --test` from `backend/` reported 13 passed, 0 failed. The new test verified the stored total of 3252 CAD cents and both item rows. |
| Failure during a write | A second test forced the second item insert to fail. The database contained zero invoices and zero items afterward and accepted the next request. |

This was a local test-first feature check. The suite captures the API behavior
and also verifies the database state after success and failure.

## LCOV included dependencies

On November 18, 2026, the first local run of `npm run test:coverage` while
preparing backend CI included Express dependencies from `backend/node_modules`.
The output reported `all files | 53.87` percent line coverage and listed
packages including `serve-static` and `vary`. That aggregate included
third-party code and obscured the team's test results.

Commit `5a37280` excludes `**/node_modules/**` from coverage. The rerun on
Node 22.23.4 passed all 21 tests and produced `backend/coverage/lcov.info`
with seven application source files. The terminal report showed 96.67% line
coverage among the files loaded by the tests. The project-wide SonarQube
coverage from the first submitted analysis appears below.

## Live conversion smoke test

On November 18, 2026, the normal server entry point started on loopback with
an in-memory database. An HTTP client created a fictional 2728-cent CAD
invoice, found it by seller name, fetched its details and requested its USD
estimate. The live Bank of Canada response yielded 1904 USD cents using the
November 18 rate of 1.4326 CAD per USD. The stored invoice was unpaid.
The automated CI suite uses fixture rates so the assertions are reproducible.

## GitHub Actions verification

The first push of `feature/backend-invoices` at `7f6a61b` passed the
**Backend checks** job on GitHub. The runner installed the locked dependencies,
initialized SQLite, checked JavaScript syntax, ran the coverage suite and
uploaded the `backend-lcov` artifact. The SonarQube job was skipped on this
feature branch. [Backend core CI run](https://github.com/shinyoungyou/invoice-receipt-devsecops/actions/runs/44400692142)

## First SonarQube analysis

On November 18, 2026, Member 2's first manual scan analyzed commit
`140af90` on `feature/backend-invoices`, after all 21 backend tests passed.
SonarQube Community Build recorded that revision on project `invoice`'s
`main` dashboard and finished processing the report successfully.
[Scanned commit](https://github.com/shinyoungyou/invoice-receipt-devsecops/commit/140af90dcd9d564f4e03a71aa337cee2400766e0) · [Server task](http://44.249.249.194:9000/api/ce/task?id=04085378-be13-4e12-a060-b18e23b2bd22)

| Measure | Reported result |
| --- | --- |
| Quality gate | Passed (`OK`). The first analysis returned an empty condition list. |
| Project coverage | 91.1% |
| Duplicated lines | 0.0% |
| Bugs / vulnerabilities / security hotspots | 0 / 0 / 0 |
| Open findings | 1 minor code smell |

The scanner reported `javascript:S7773` in `backend/invoices/routes.js` at
line 14. The invalid-pagination path returns the global `NaN`. The rule
prefers `Number.NaN`. Both values represent the same invalid-number result.
The finding concerns maintainability. It was open at this revision. The fix
and rescan for the before-and-after demo are pending.
[Scanned line](https://github.com/shinyoungyou/invoice-receipt-devsecops/blob/140af90dcd9d564f4e03a71aa337cee2400766e0/backend/invoices/routes.js#L14) · [SonarQube issue S7773](http://44.249.249.194:9000/project/issues?id=invoice&open=812e2a0b-71f6-4d33-a37f-3a5a894e4218) · [Recorded quality gate](http://44.249.249.194:9000/api/qualitygates/project_status?analysisId=b3cf5691-b31f-477c-bbc6-645e979d3471)
