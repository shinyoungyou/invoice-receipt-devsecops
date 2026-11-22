# Team demo evidence

Each member records real failures, findings and fixes from their own work, with
the commit, check or scan that shows them. Screenshots are in
[`docs/evidence/`](evidence/). The format follows
[`demo-evidence-example.md`](demo-evidence-example.md).

| Member | Section |
| --- | --- |
| Member 2 | [Invoices, USD conversion, backend CI and SonarQube](#member-2--invoices-usd-conversion-backend-ci-and-sonarqube) |
| Member 1 | [Frontend, frontend CI and SonarQube Community Build and Cloud](#member-1--frontend-frontend-ci-and-sonarqube-community-build-and-cloud) |
| Member 3 | Payments evidence to be added by Member 3 |

## Member 2 — Invoices, USD conversion, backend CI and SonarQube

### Invoice creation from HTTP request through SQLite

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

### LCOV included dependencies

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

### Live conversion smoke test

On November 18, 2026, the normal server entry point started on loopback with
an in-memory database. An HTTP client created a fictional 2728-cent CAD
invoice, found it by seller name, fetched its details and requested its USD
estimate. The live Bank of Canada response yielded 1904 USD cents using the
November 18 rate of 1.4326 CAD per USD. The stored invoice was unpaid.
The automated CI suite uses fixture rates so the assertions are reproducible.

### GitHub Actions verification

The first push of `feature/backend-invoices` at `7f6a61b` passed the
**Backend checks** job on GitHub. The runner installed the locked dependencies,
initialized SQLite, checked JavaScript syntax, ran the coverage suite and
uploaded the `backend-lcov` artifact. The SonarQube job was skipped on this
feature branch. [Backend core CI run](https://github.com/shinyoungyou/invoice-receipt-devsecops/actions/runs/44400692142)

### First SonarQube analysis

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

## Member 1 — Frontend, frontend CI and SonarQube Community Build and Cloud

Member 1 built the frontend on `feature/frontend`. It was scanned in two ways:

- **Phase A:** a local SonarQube Community Build, during development. This is
  "shift left": fast feedback without overwriting the shared `main`
  dashboard, which Community Build analyzes as a single branch.
- **Phase B:** SonarQube Cloud (free OSS plan), on a demo pull request. This
  compared the editions and ran deliberate failures for the presentation.

The team's quality gate on `main` remains the enforcement layer.

**At a glance:**

| Entry | What happened | Caught by |
| --- | --- | --- |
| E01 | Unhandled promises could leave pages stuck on "Loading…" (`javascript:S9383`), plus `Number.NaN` (`S7773`) | Community Build |
| E02 | A "fix" commit contained only the tests; CI failed it | Frontend CI |
| E03 | The fix introduced a new S9383; the gate failed on "new issues" | Community Build quality gate |
| E04 | A feature was scanned before its tests; coverage on new code was 75.4% | Community Build quality gate |
| E05 | CI installs ran dependency lifecycle scripts (`githubactions:S6505`) | SonarQube Cloud only |
| E06 | Client-side path traversal into `fetch()` (`jssecurity:S8476`, High) | SonarQube Cloud only (taint analysis) |
| E07 | Deliberate failures on a demo pull request: two caught, two missed, one blocked by GitHub | Cloud, review and GitHub push protection |

### Phase A timeline: from first failure to passing gate

Phase A scans used a local SonarQube Community Build (v26.11) with project
`invoice-frontend-dev`. All CI runs are the **Frontend checks** job on
`feature/frontend`.

| # | When | What ran | Result | Entry |
| --- | --- | --- | --- | --- |
| 1 | Nov 19, 12:33 | First SonarQube scan of `2401950` | **Finding.** 4 open issues (3 × `javascript:S9383`, 1 × `javascript:S7773`), Reliability C. The gate passed because a first analysis has no new code to judge | E01 |
| 2 | Nov 19, 13:27 | Local tests before the fix | **Failure.** The 4 new regression tests failed against the unfixed source, with 4 unhandled rejections | E01 |
| 3 | Nov 19, 13:27 | Frontend CI on `f8d5a4c` | **Failure.** The commit contained only the tests; the source fix was still in `git stash`. 4 failed, 133 passed | E02 |
| 4 | Nov 21 | Frontend CI on the follow-up commit `a9f98a6` | **Passed.** The commit list shows ✓ 1/1 for `a9f98a6` and ✗ 0/1 for `f8d5a4c` | E02 |
| 5 | Nov 21, 1:43 PM | Second SonarQube scan, after the follow-up commit | **Quality gate failed.** The fix introduced 1 new `S9383` issue (`invoice-list.js:94`). "New issues" was 1, and the gate requires 0 | E03 |
| 6 | Nov 21, about 1:51 PM | Commit 11b `de0a6d1`, then the third scan | **Passed.** 0 open issues, overall coverage 99.4%, and the L94 issue marked Closed (Fixed) | E03 |
| 7 | Nov 21 | SonarQube scan of `e4a3f0f` (receipt feature) before its tests were applied | **Quality gate failed.** Coverage on new code was 75.4%, and the gate requires 80% | E04 |
| 8 | Nov 21 | Commit `f98f29f` (receipt tests), then a rescan | **Passed.** Coverage on new code was 96.9%, with 0 new issues | E04 |
| 9 | Nov 21 | Full-repository dry run of the team configuration (`03d2515`) on local project `invoice-full-dev` | **Verified.** Backend 94.5% and frontend 98.6% coverage were both imported, with no "Could not resolve" warnings | Pipeline wiring |

The story in one sentence: SonarQube found a reliability risk, the tests
reproduced it, CI caught an incomplete fix commit, and the quality gate caught
both a new issue introduced by the fix and a feature scanned before its tests,
before any of it reached `main`.

### E01 — SonarQube found unhandled promises in the frontend

| Field | Actual value |
| --- | --- |
| Member and feature | Member 1. Frontend routing, invoice list and invoice detail (`frontend/src/`) |
| Date and branch | November 19, 2026, `feature/frontend` |
| Failing commit / PR | `2401950` (`test: cover list/search and detail rendering`), the last commit before the fix |
| Tool and command or scan configuration | Local SonarQube Community Build v26.11 in Docker, project `invoice-frontend-dev`. Scanner run from the repo root after `npm run test:coverage` in `frontend/`: `sonar-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.projectBaseDir=frontend -Dsonar.projectKey=invoice-frontend-dev -Dsonar.sources=src -Dsonar.tests=tests -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info -Dsonar.scm.disabled=true` |
| Test name or SonarQube rule ID | `javascript:S9383` (Promises should not be left unhandled), 3 issues. `javascript:S7773` (Prefer `Number.NaN` over `NaN`), 1 issue |
| Reported classification and severity, if applicable | S9383: Reliability, Medium. S7773: Reliability Medium and Maintainability Low |
| Failure / finding / warning message | "Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator." and "Prefer `Number.NaN` over `NaN`." |
| Expected behavior | If a screen fails while rendering, the user sees an error message |
| Observed behavior | Async render calls had no rejection handling. An unexpected error would become an unhandled rejection and the page would stay on "Loading…" |
| CI or scan link | Local server only, so screenshots are the record. First scan: November 19, 2026, 12:33 PM |
| Did it actually block merge or release? How? | No. The local scan is advisory. The first analysis of a new project has no new code, so the quality gate passed. The findings were fixed before the PR |

**First scan results:**

| Measure | Reported result |
| --- | --- |
| Quality gate | Passed (first analysis, no new code to judge) |
| Coverage | 99.6% on 300 lines to cover |
| Duplications | 0.0% |
| Security / Reliability / Maintainability | 0 / 4 (rated C) / 1 open issues |
| Security hotspots | 0 |
| Lines of code | 631 |

The dashboard also showed SonarQube's own "Limited security analysis" notice:
Community Build does not scan for injection vulnerabilities such as SQL
injection and XSS.

**Issue locations:**

| Rule | Location | Code |
| --- | --- | --- |
| S9383 | `src/main.js:55` | `render({ moveFocus: false });` (first page load) |
| S9383 | `src/views/invoice-detail.js:81` | Retry button calls `renderInvoiceDetail(...)` |
| S9383 | `src/views/invoice-list.js:91` | Retry button calls `loadPage(offset)` |
| S7773 | `src/views/invoice-form.js:195` | Invalid quantity parsed as global `NaN` |

Two call sites with the same risk were not flagged: the `popstate` handler at
`src/main.js:54` and the **Load more** button in `invoice-list.js`. Both
return the promise from an arrow function, so the rule did not report them.

**Cause and impact:**

S9383 is a real reliability bug with low likelihood. API errors were already
handled inside each view, but an unexpected error such as malformed server data
or a coding mistake escaped as an unhandled promise rejection. The user would
see a screen stuck on "Loading…" with no message and no way to recover.

S7773 is a maintainability and convention issue, not a bug. `NaN` and
`Number.NaN` are the same value. It is the same rule Member 2 received on the
backend (`backend/invoices/routes.js:14`), so the same standard applies across
the codebase.

**Before evidence:**

- [m1-sonar-first-scan.png](evidence/m1-sonar-first-scan.png): dashboard with Reliability C and 4 issues
- [m1-sonar-issue-list.png](evidence/m1-sonar-issue-list.png): all four issues
- [m1-sonar-s9383-main-js.png](evidence/m1-sonar-s9383-main-js.png): issue detail with rule ID and line 55
- [m1-sonar-s7773-form.png](evidence/m1-sonar-s7773-form.png): issue detail at `invoice-form.js:195`, with rule `javascript:S7773`

The regression tests were also run locally against the unfixed source, using
`git stash push -- frontend/src`. They gave 4 failed, 133 passed and 4
unhandled errors. No screenshot was kept; the CI run in E02 shows the same
result.

**Fix or review decision:**

Fix all four. The change touched three areas:

- **`main.js`:** `render()` catches unexpected errors and shows "Something went wrong while showing this page. Reload to try again." The first-load and `popstate` calls are marked `void` because `render()` now handles its own errors.
- **Retry and Load more buttons:** in `invoice-detail.js` and `invoice-list.js`, these route unexpected errors to the same message through a shared `showUnexpectedError` helper in `shared.js`.
- **`invoice-form.js`:** uses `Number.NaN`.

Four regression tests feed malformed server data (`items: null`, non-integer
`totalCents`) and check that the message appears instead of an endless
loading state.

The fix landed in three commits:

- `f8d5a4c`: regression tests only, by mistake (see E02)
- `a9f98a6` (`fix: add source changes missing from f8d5a4c`): source changes
- `de0a6d1` (`fix: stop returning the retry promise from loadPageSafely`): corrects a new issue the fix introduced (see E03)

**Verification and after evidence:** see E03. The second scan showed the
fix's effect, and the third scan is the final result.

**Presentation talking points:**

1. **What was reported:** SonarQube flagged async calls whose errors had nowhere to go, plus a convention issue Member 2 also had.
2. **How it was found:** a local scan before merging. This was "shift left": fast feedback without overwriting the shared `main` dashboard, which Community Build analyzes as a single branch.
3. **What changed:** errors are now caught and shown, and regression tests reproduce the original failure.
4. **What shows the outcome:** before and after scans, tests that fail on the old code and pass on the new code, and a green CI run.
5. **What it did not prove:**
   - The local scan is advisory. The CI quality gate on `main` is the enforcement.
   - The rule missed two equivalent call sites.
   - Community Build does not detect injection vulnerabilities at all.

### E02 — CI caught an incomplete fix commit

| Field | Actual value |
| --- | --- |
| Member and feature | Member 1. Frontend CI (`.github/workflows/frontend-ci.yml`, job **Frontend checks**) |
| Date and branch | November 19, 2026, `feature/frontend` |
| Failing commit / PR | `f8d5a4c` (`fix: handle floating promises and use Number.NaN`) |
| Tool and command or scan configuration | GitHub Actions, Node 22.23.4, `npm run test:coverage` in `frontend/` |
| Test name or SonarQube rule ID | `app-shell.test.js`: "an unexpected error while rendering shows a message instead of a stuck loading screen". `invoice-detail.test.js` and `invoice-list.test.js`: "an unexpected error after retrying shows a message instead of being lost". `invoice-list.test.js`: "an unexpected error from "Load more" shows a message instead of being lost" |
| Reported classification and severity, if applicable | Failed tests (4) and unhandled rejections (4) |
| Failure / finding / warning message | `TypeError: Cannot read properties of null (reading 'map')` at `renderInvoiceDetail` ← `render src/main.js:37`, reported as an Unhandled Rejection. Also `TypeError: Expected integer cents, got not cents` at `invoiceRow` ← `loadPage` |
| Expected behavior | The fix commit includes both the source changes and the tests |
| Observed behavior | The commit contained only the three test files. The source changes were still in a local `git stash` from the before-fix test run. CI reported 4 failed and 133 passed |
| CI or scan link | [Frontend CI run for `f8d5a4c`](https://github.com/shinyoungyou/invoice-receipt-devsecops/actions/runs/44608786830/job/135859489935) |
| Did it actually block merge or release? How? | Yes. The **Frontend checks** job failed on the branch, so the commit could not pass review into `main` |

**Cause and impact:**

This was a process mistake, not a product bug. To capture before-fix
evidence, the source changes were stashed and the new tests were run against
the old code. The commit was then made before `git stash pop`, so it included
the tests but not the fix. Without CI, a commit titled "fix" that fixed
nothing could have been merged.

The failure log is also useful evidence for E01. The unhandled rejection
stack trace runs through `render` in `src/main.js`, the exact location
SonarQube flagged as S9383.

**Before evidence:**

- [m1-ci-f8d5a4c-failed-tests.png](evidence/m1-ci-f8d5a4c-failed-tests.png): the failing test and `Tests  4 failed | 133 passed (137)`
- [m1-ci-f8d5a4c-unhandled-rejection.png](evidence/m1-ci-f8d5a4c-unhandled-rejection.png): the `TypeError` stack trace ending in `render src/main.js:37:23`
- The full log of that run is saved outside the repo, because GitHub deletes Actions logs after the retention period

**Fix or review decision:**

The source changes were restored with `git stash pop`, verified locally with
137 tests passing, and pushed as a follow-up commit. The pushed commit was not
amended, to avoid force-pushing a shared branch.
Follow-up commit: `a9f98a6` (`fix: add source changes missing from f8d5a4c`).

**Verification:**

- The branch's commit list shows Frontend CI ✓ 1/1 on `a9f98a6` and ✗ 0/1 on `f8d5a4c`
- Locally, 137 tests passed on `a9f98a6`

**After evidence:**

- [m1-ci-followup-passed.png](evidence/m1-ci-followup-passed.png): the commit list with the red and green checks

**Presentation talking points:**

1. **What went wrong:** the fix commit didn't contain the fix.
2. **How it was revealed:** CI ran the new regression tests against the code actually pushed, not the code on my laptop.
3. **What changed:** the source changes went in as a follow-up commit, without force-pushing.
4. **What shows the outcome:** a red run on `f8d5a4c` and a green run on the follow-up.
5. **What it did not prove:** CI only checks what the tests cover. It caught this because the regression tests were written first.

### E03 — Quality gate failed on a new issue introduced by the fix

| Field | Actual value |
| --- | --- |
| Member and feature | Member 1. Invoice list retry and Load more (`frontend/src/views/invoice-list.js`) |
| Date and branch | November 21, 2026, `feature/frontend` |
| Failing commit / PR | `a9f98a6`, the E02 follow-up commit |
| Tool and command or scan configuration | Same local SonarQube project and scanner command as E01. Second analysis of the project. New code period: since November 19, 2026, the first analysis |
| Test name or SonarQube rule ID | `javascript:S9383` (Promises should not be left unhandled), 1 new issue |
| Reported classification and severity, if applicable | Reliability, Medium. Code attribute: Intentionality (not logical) |
| Failure / finding / warning message | Quality gate **Failed**, with 1 failed condition: "New issues: 1, Required = 0". The issue was at `src/views/invoice-list.js:94`: `loadPageSafely(offset);` |
| Expected behavior | The fix closes the original issues without adding new ones |
| Observed behavior | The new helper `loadPageSafely` returned the promise from `loadPage(offset).catch(...)`. The bare call in the retry button left that returned promise unused, so the rule flagged it |
| CI or scan link | Local server only. Second scan: November 21, 2026, 1:43 PM |
| Did it actually block merge or release? How? | Locally, the gate failed. The local gate is not wired to merging, so it did not block anything by itself. It was fixed before the PR |

**Second scan results (new code):**

| Measure | Reported result | Gate condition |
| --- | --- | --- |
| Quality gate | **Failed**, 1 condition | |
| New issues | **1** | Required = 0 (failed) |
| Coverage on new code | 95.7% on 15 new lines to cover | Required ≥ 80.0% (passed) |
| Duplications on new code | 0.0% on 100 new lines | Required ≤ 3.0% (passed) |
| Security hotspots | 0 | |
| Lines of code | 645 | |

This was the first analysis where the gate judged new code. The first scan
in E01 had nothing to judge.

**Cause and impact:**

The returned promise could not actually reject, because `.catch` already
handled the error. So this was closer to a false positive than a real bug.
The code was still ambiguous, though: a reader, and the analyzer, could not
tell at the call site that nothing was left unhandled. A one-line change made
the intent explicit, so fixing it was better than marking it "Accepted."

**Before evidence:**

- [m1-sonar-gate-failed-new-code.png](evidence/m1-sonar-gate-failed-new-code.png): New Code tab with the gate Failed, "New issues 1, Required = 0", coverage 95.7%
- [m1-sonar-s9383-list-l94.png](evidence/m1-sonar-s9383-list-l94.png): issue detail at `invoice-list.js:94`, with rule `javascript:S9383`

**Fix or review decision:**

Commit `de0a6d1`, `fix: stop returning the retry promise from
loadPageSafely`. `loadPageSafely` became a function that returns nothing:

```js
function loadPageSafely(offset) {
  loadPage(offset).catch(err => showUnexpectedError(results, err));
}
```

Callers no longer receive a promise, so nothing is left unhandled. Behavior is
unchanged, and all 137 tests pass.

**Verification:**

- Local: `npm test` in `frontend/` reports 137 passed, 0 failed on `de0a6d1`
- Third scan, November 21, 2026, about 1:51 PM: quality gate **Passed**, with 0 open issues, 0.0% duplications, 99.4% overall coverage and 647 lines of code
- The issue at `invoice-list.js:94` shows "This issue is Closed (Fixed). It was detected in the file below and is no longer being detected."
- The issue list for open and confirmed issues shows "No Issues. Hooray!"
- Overall code at the next scan, after `d77c55d`: Security, Reliability and Maintainability all 0 open issues, rated A. In E01 Reliability was C, with 4 open issues
- Later routine scans also kept the gate passing; see "Routine scans" below

**After evidence:**

- [m1-sonar-gate-passed-after-fix.png](evidence/m1-sonar-gate-passed-after-fix.png): overview with the gate Passed, 0 issues and 99.4% coverage
- [m1-sonar-l94-closed-fixed.png](evidence/m1-sonar-l94-closed-fixed.png): the L94 issue marked Closed (Fixed)
- [m1-sonar-no-open-issues.png](evidence/m1-sonar-no-open-issues.png): "No Issues. Hooray!"
- [m1-sonar-overall-after.png](evidence/m1-sonar-overall-after.png): Overall Code, with 0 open issues and all ratings A

**Presentation talking points:**

1. **What went wrong:** my fix for one finding introduced a new finding of the same rule.
2. **How it was revealed:** the quality gate's "no new issues" condition. This was the first time the gate had new code to judge.
3. **What changed:** a one-line refactor so the helper returns nothing.
4. **What shows the outcome:** gate Failed, then Passed, with the issue moving to Fixed.
5. **What it did not prove:**
   - The flagged promise could not actually reject, so the finding was about clarity more than a live bug.
   - The local gate does not block merges; the team's CI gate on `main` does.

### E04 — Quality gate failed when a feature was scanned before its tests

| Field | Actual value |
| --- | --- |
| Member and feature | Member 1. Receipt download (`frontend/src/api.js`, `external.js`, `views/payment.js`) |
| Date and branch | November 21, 2026, `feature/frontend` |
| Failing commit / PR | `e4a3f0f` (`feat: enable receipt download only for paid invoices`) |
| Tool and command or scan configuration | Same local SonarQube project and scanner command as E01, after `npm run test:coverage` |
| Test name or SonarQube rule ID | Quality gate condition: coverage on new code ≥ 80.0% |
| Reported classification and severity, if applicable | Quality gate condition (coverage). No new issues |
| Failure / finding / warning message | "1 condition failed: 75.4% Coverage is less than 80.0%" |
| Expected behavior | New code reaches the gate with tests covering it |
| Observed behavior | The scan ran on the receipt feature before its test commit was applied. `npm run test:coverage` reported 174 tests rather than 186. The uncovered lines were exactly the new receipt code |
| CI or scan link | Local server only. November 21, 2026, about 2:45 PM |
| Did it actually block merge or release? How? | Locally, the gate failed. The local gate is not wired to merging. The tests were added before the PR |

**Scan results:**

| Measure | Before (`e4a3f0f`) | After (`f98f29f`) |
| --- | --- | --- |
| Quality gate | **Failed** | **Passed** |
| Coverage on new code | 75.4% on 157 new lines (required ≥ 80.0%) | **96.9%** on the same 157 new lines |
| New issues | 0 | 0 |
| Duplications on new code | 0.0% | 0.0% |
| Lines of code | 922 | 922 |

The analyzed source code was identical in both scans; only `tests/` changed.
"Lines of code" counts `src/` only.

**Uncovered lines reported by Vitest before the fix:**

| File | Uncovered lines | Code |
| --- | --- | --- |
| `src/api.js` | 113–136 | `downloadReceipt` |
| `src/external.js` | 25–33 | `saveFile` |
| `src/views/payment.js` | 62–63, 69, 76–94 | Receipt button and download handling |

**Cause and impact:**

This was a process error, not a product bug. The feature commit was scanned
before the test commit was applied, so the gate measured untested code. This
is exactly the situation the coverage condition exists to catch: code
reaching the gate without tests.

The case also shows a limit. SonarQube only knows what the coverage report
tells it. A missing or stale `lcov.info` produces a wrong coverage result
just as easily. Commit `3cb54bb` (`ci: generate frontend coverage before
quality gate`) prevents that in the team pipeline. It generates frontend
coverage in the same job, immediately before the scan.

**Before evidence:**

- [m1-sonar-gate-failed-coverage.png](evidence/m1-sonar-gate-failed-coverage.png): New Code tab, gate Failed, 75.4%

**Fix or review decision:**

Commit `f98f29f` (`test: cover receipt availability and rejected receipt
request`). Its 12 tests cover the PDF download, file-name cleaning, a
non-PDF response, `409 INVOICE_NOT_PAID`, the receipt button states and
`saveFile`.

**Verification:**

- Local: `npm run test:coverage` reports 186 passed and 100% line coverage
- Rescan: quality gate **Passed**, coverage on new code 96.9%, 0 new issues

**After evidence:**

- [m1-sonar-gate-passed-coverage.png](evidence/m1-sonar-gate-passed-coverage.png): New Code tab, gate Passed, 96.9%
- [m1-sonar-frontend-final.png](evidence/m1-sonar-frontend-final.png): Overall Code of the finished frontend. Gate Passed; Security, Reliability and Maintainability all 0 open issues, rated A; coverage 98.6% on 433 lines to cover; duplications 0.0%; 922 lines of code

**Presentation talking points:**

1. **What went wrong:** a feature was scanned before its tests were applied.
2. **How it was revealed:** the quality gate's coverage condition on new code.
3. **What changed:** the tests were applied. The CI job now generates coverage itself right before scanning.
4. **What shows the outcome:** 75.4% and Failed, then 96.9% and Passed, on the same source lines.
5. **What it did not prove:** coverage shows lines ran during tests, not that the assertions are meaningful.

### Pipeline wiring verification — frontend coverage in the team SonarQube configuration

This was not a failure. It is a check that the team configuration change
works before it reaches the shared server.

- **Commit `03d2515`** (`chore: import frontend coverage into SonarQube`) added three things to `sonar-project.properties`:
  - `frontend/tests` as test code
  - `frontend/coverage/lcov.info` as a coverage report
  - `frontend/*.config.js` excluded from coverage
- **It also changed the frontend coverage report** to write paths relative to the repo root (`frontend/src/...`), matching the backend report.
- **Commit `3cb54bb`** added frontend coverage generation to the SonarQube job in `backend-core-ci.yml`.

**Dry run:** a full-repository scan from the repo root on the local project
`invoice-full-dev`, using the team's `sonar-project.properties` with only the
project key overridden. Run November 21, 2026.

| Measure | Result |
| --- | --- |
| Lines of code | 1.7k (backend and frontend) |
| Coverage, overall | 96.1% (1,235 lines to cover, 48 uncovered; 477 conditions, 19 uncovered) |
| `backend/` | 94.5% |
| `frontend/` | 98.6%, 0 uncovered lines |
| "Could not resolve" warnings | None |
| Open issues | 1. This is Member 2's `javascript:S7773` at `backend/invoices/routes.js:14` (`return NaN` in `pageInteger`), introduced before this work. It is not a Member 1 change; Member 2 was told it is still open |

- [m1-sonar-full-repo-coverage.png](evidence/m1-sonar-full-repo-coverage.png): the Coverage tree with the backend and frontend rows
- [m1-sonar-full-repo-open-issue.png](evidence/m1-sonar-full-repo-open-issue.png): the one open issue, Member 2's S7773

**After the PR merges:** **TODO.** Record the first `main` run of the
**SonarQube quality gate** job, including the frontend steps and the gate
result, with the run link and a screenshot.

### Routine scans

These scans ran on the local `invoice-frontend-dev` project after each
feature and its tests. Nothing failed except the E04 scan, so no fixes were
needed.

| After commit | New code coverage | New issues | Gate | Lines of code |
| --- | --- | --- | --- | --- |
| `d77c55d` (USD estimate tests) | 97.9% on 32 new lines | 0 | Passed | 698 |
| `f99ab1e` (payment tests) | 97.3% on 106 new lines | 0 | Passed (overall coverage 99.0%, all ratings A) | 854 |
| `e4a3f0f` (receipt feature, scanned before its tests) | 75.4% on 157 new lines | 0 | **Failed**; see E04 | 922 |
| `f98f29f` (receipt tests) | 96.9% on 157 new lines | 0 | Passed | 922 |

**Manual check of the live USD estimate (November 21, 2026):**

An invoice of $32.52 CAD showed "Estimated USD equivalent — charged in CAD:
US$22.70" with "Bank of Canada rate 1.4325 CAD per USD, Nov 20, 2026." The
browser's network tab showed the `conversion?currency=USD` response
(`estimatedTotalCents: 2270`, `rateDate: "2026-11-20"`). That confirms the
frontend displays the backend's live Bank of Canada data, not a client-side
calculation. Screenshot: [m1-usd-estimate-live.png](evidence/m1-usd-estimate-live.png).

### E05 — SonarQube Cloud: CI installs ran dependency lifecycle scripts

| Field | Actual value |
| --- | --- |
| Member and feature | Member 1. CI workflows (`frontend-ci.yml`, and the SonarQube job step added to `backend-core-ci.yml`) |
| Date and branch | November 21, 2026. First SonarQube Cloud analysis of `main` (`47aea4a`) |
| Tool and command or scan configuration | SonarQube Cloud, OSS plan, project `shinyoungyou_invoice-receipt-devsecops`, automatic analysis of `main` |
| Test name or SonarQube rule ID | `githubactions:S6505`: "Unrestricted JavaScript package manager scripts should not be executed during installation" |
| Reported classification and severity, if applicable | Security, Medium. Tags `cwe` and `former-hotspot` |
| Failure / finding / warning message | "Omitting "--ignore-scripts" allows lifecycle scripts to run during package installation." Reported at line 27 (`npm ci`) of `backend-core-ci.yml` and of `backend-payments-ci.yml` |
| Expected behavior | CI installs dependencies without running their install scripts |
| Observed behavior | Plain `npm ci` runs every dependency's `preinstall`/`postinstall` scripts inside the CI runner |
| CI or scan link | SonarQube Cloud project for `main`. First analysis: 1.6k lines of code; 2 security issues (rating C); 1 reliability and 1 maintainability issue (Member 2's `S7773`) |
| Did it actually block merge or release? How? | No. It was a first analysis with no gate result |

**Cause and impact:**

If any package in the dependency tree were compromised (a supply-chain
attack), its install script would run in CI, with access to the runner and
any credentials in the job. This is a pipeline-hardening finding, not a bug
in the application.

**Community Build comparison:**

The Member 1 full-repository dry run on Community Build scanned the same
workflow files. It reported only Member 2's `S7773`.

**Fix or review decision:**

- **Member 1's own steps were fixed** before they could be flagged: the
  `frontend-ci.yml` install step and the SonarQube job's "Install frontend
  dependencies" step now use `npm ci --ignore-scripts` (commit
  `ci: install frontend dependencies with --ignore-scripts`). With
  `--ignore-scripts`, frontend lint, tests, build and `npm audit` all passed.
  The backend's 40 tests also passed.
- **The two flagged lines belong to Members 2 and 3** and were reported to
  them with the same fix.

**Evidence:**

- [m1-cloud-main-baseline.png](evidence/m1-cloud-main-baseline.png): first Cloud analysis of `main`
- [m1-cloud-security.png](evidence/m1-cloud-security.png): the two S6505 issues
- [m1-cloud-security-1.png](evidence/m1-cloud-security-1.png): S6505 in `backend-core-ci.yml`
- [m1-cloud-security-2.png](evidence/m1-cloud-security-2.png): S6505 in `backend-payments-ci.yml`

### E06 — SonarQube Cloud: client-side path traversal into `fetch()`

| Field | Actual value |
| --- | --- |
| Member and feature | Member 1. Frontend API client (`frontend/src/api.js`) |
| Date and branch | November 21, 2026, `demo/sonar-gate`, the baseline branch copied from `feature/frontend` |
| Failing commit / PR | `ef07143` (B1) and `88f1f99` (after the first fix) |
| Tool and command or scan configuration | SonarQube Cloud, run from GitHub Actions (`sonar-demo.yml`) with backend and frontend coverage |
| Test name or SonarQube rule ID | `jssecurity:S8476`: "Client-side requests should not be vulnerable to forging attacks" |
| Reported classification and severity, if applicable | Security, **High**. CWE-20 (Improper Input Validation), OWASP Top 10 2021 A03 Injection |
| Failure / finding / warning message | "Client-Side Request Forgery via unsanitized user input" at `frontend/src/api.js:29` (`fetch(`${API_BASE}${path}`, init)`). The gate failed: "Security rating is B (rating required A)" |
| Expected behavior | Data from outside the code cannot change which API path a request goes to |
| Observed behavior | Taint analysis traced data from a server response (`response.json()`, the source) through 21 and 26 steps into `fetch()` (the sink) |
| CI or scan link | The SonarQube Cloud demo workflow and the SonarCloud Code Analysis check on the branch commits |
| Did it actually block merge or release? How? | On the demo branch, yes: both checks failed (✗ 0/2) until fixed |

**Was it real? Yes.**

`invoicePath()` escaped IDs with `encodeURIComponent()`, which does not
escape dot segments:

```text
encodeURIComponent('..')                      → '..'
fetch('/api/invoices/' + '..' + '/checkout') → POST /api/checkout
```

An invoice ID of `..` from a compromised or buggy server response would
therefore send a request to a different endpoint: a client-side path
traversal. Community Build has no taint analysis, so it could not report
this.

**Fix, in two steps:**

1. **`fix: reject unsafe invoice IDs before building API paths`**
   - IDs must match `^[A-Za-z0-9_-]{1,100}$` (the backend issues UUIDs); anything else fails with `INVALID_INVOICE_ID` before any request is sent.
   - The detail page shows "Invoice not found" for an invalid ID.
   - Tests cover 13 hostile IDs across all four invoice API calls.

   The rescan still failed, but on a different flow, so the server-data
   flows were gone. The remaining flow started at `location.search`: the
   `?q=` search text.
2. **`fix: refuse API requests that leave the same-origin /api/ path`**
   - Every request URL is resolved against the page origin and refused unless it stays on that origin under `/api/`. This follows Sonar's own guidance to validate the full origin.
   - The search text only ever reaches the query string through `URLSearchParams`. A test sends `../../admin?x=1#/../checkout` and checks the request stays at `/api/invoices?q=…`.

**Verification:**

- Frontend tests: 203 passed, 100% line coverage. Frontend CI was green on both fix commits.
- SonarQube Cloud: both checks passed (✓ 2/2). The issue's status is **Fixed**, and the branch shows 0 open issues.

**Evidence:**

- [m1-cloud-s8476-list.png](evidence/m1-cloud-s8476-list.png): the issue on the branch
- [m1-cloud-s8476-flow.png](evidence/m1-cloud-s8476-flow.png): source `response.json()` to sink `fetch()`
- [m1-cloud-warnings.png](evidence/m1-cloud-warnings.png): two harmless analysis warnings (ignored `sonar.sources`/`sonar.tests`, and the PL/SQL dictionary)
- [m1-cloud-s8476-flow2-search.png](evidence/m1-cloud-s8476-flow2-search.png): the remaining flow from `location.search`
- [m1-cloud-s8476-why.png](evidence/m1-cloud-s8476-why.png), [m1-cloud-s8476-how-to-fix.png](evidence/m1-cloud-s8476-how-to-fix.png), [m1-cloud-s8476-more-info.png](evidence/m1-cloud-s8476-more-info.png): the rule's explanation, fix guidance and CWE-20
- [m1-cloud-checks-green.png](evidence/m1-cloud-checks-green.png): ✓ 2/2 after the fixes
- [m1-cloud-baseline-green.png](evidence/m1-cloud-baseline-green.png): the branch gate Passed
- [m1-cloud-s8476-fixed.png](evidence/m1-cloud-s8476-fixed.png): the issue marked Fixed
- [m1-a21-a22-frontend-ci-green.png](evidence/m1-a21-a22-frontend-ci-green.png): Frontend CI green on both fixes

**Presentation talking points:**

1. **What was reported:** server data could steer a `fetch()` to another API path.
2. **How it was found:** SonarQube Cloud taint analysis; Community Build has none.
3. **What changed:** an ID allowlist plus a same-origin `/api/` guard, each with tests.
4. **What shows the outcome:** red, then a different remaining flow, then green with the issue Fixed.
5. **What it did not prove:** the analyzer only follows data flows it can model (see E07, B8).

### E07 — Deliberate failures on a demo pull request (Phase B)

The deliberate failures ran on **draft pull request #1**, from
`demo/sonar-gate` into `demo/baseline`. Neither branch is ever merged to
`main`. The workflow `sonar-demo.yml` exists only on these branches and uses
its own `SONAR_CLOUD_TOKEN`.

**Why a pull request:**

As a branch, `demo/sonar-gate` was always compared with `main`, which does
not yet contain the frontend, so about 1.1k lines counted as new code. Setting
the scan version per push (`f6d7e12`) did not change that. For a pull
request, SonarQube Cloud counts only the pull request's own changes as new
code, so each deliberate failure was judged on its own lines.

| Step | Commit | Deliberate weakness | Result |
| --- | --- | --- | --- |
| B2 | analyzed at `714870d` | `discount.js` with no tests, money math in float dollars | 🔴 **Caught.** Coverage on new code 0.0% (required ≥ 80%) on 27 new lines. "Estimated after merge" was still 96.6% |
| B3 | `a5a89bd` | Tests added; switched to integer cents | 🟢 Passed. 6 of the 15 new tests fail on the B2 code (for example `applyDiscount(115, '')` returned 114) |
| B4 | — | Receipt references from `Math.random()` | 🟢 **Missed.** 0 new issues, 0 security hotspots, coverage 100% |
| B5 | `1f5cbb3` | Switched to `crypto.getRandomValues()` | 🟢 A test now fails if `Math.random` is called |
| B6 | `2b7e640` (never pushed) | Fake Stripe secret key in frontend code | ⛔ **Blocked by GitHub push protection** (GH013, "Highnote SK Test Key" at `frontend/src/stripe-config.js:9`). The commit was removed locally; the key never reached GitHub or SonarQube |
| B8 | `1eadb5c` | Invoice search SQL built by string concatenation | 🟢 **Missed.** 0 new issues. The injection was real: `q = zzz') > 0 OR 1=1 OR instr('a', 'b` returned every invoice, and all 40 backend tests still passed |
| B9 | `82ca60b` | `git revert` of B8 | 🟢 Parameterized query restored |

**Notes on the misses:**

- **B4:** the scanner did not treat `Math.random()` as security-sensitive here.
  Review caught it, and a test now enforces the fix.
- **B8:** the likely reason is that the backend uses Node's new built-in
  `node:sqlite` driver, which the taint analyzer probably has no model for, so
  `DatabaseSync.prepare()` is not known to execute SQL. This is an
  explanation, not something SonarQube reported. The protection on `main` is
  the parameterized query, not the scanner.

**Evidence:**

- [m1-b2-pr-red.png](evidence/m1-b2-pr-red.png): pull request checks failing
- [m1-b2-gate-failed-coverage.png](evidence/m1-b2-gate-failed-coverage.png): 0.0% coverage on 27 new lines
- [m1-b2-uncovered-lines.png](evidence/m1-b2-uncovered-lines.png): the untested lines in `discount.js`
- [m1-b3-pr-green.png](evidence/m1-b3-pr-green.png), [m1-b3-gate-passed-coverage.png](evidence/m1-b3-gate-passed-coverage.png): back to green
- [m1-b4-pr-green-missed.png](evidence/m1-b4-pr-green-missed.png): gate passed with `Math.random()`
- [m1-b6-github-push-protection.png](evidence/m1-b6-github-push-protection.png): push blocked
- [m1-b8-pr-green-missed.png](evidence/m1-b8-pr-green-missed.png): gate passed with a working SQL injection

### Community Build and SonarQube Cloud compared

| Case | Community Build (local) | SonarQube Cloud (OSS plan) |
| --- | --- | --- |
| Unhandled promises (`S9383`), `Number.NaN` (`S7773`) | Reported (E01) | Not re-tested; fixed before the Cloud scans |
| Coverage and new-issue gate conditions | Enforced (E03, E04) | Enforced (E07, B2) |
| CI installs run dependency scripts (`S6505`) | Not reported | **Reported** (E05) |
| Client-side path traversal (`S8476`) | Not possible: no taint analysis | **Reported, High** (E06) |
| `Math.random()` for references | Not tested | Not reported (B4) |
| SQL injection through `node:sqlite` | Not possible: no taint analysis | Not reported (B8) |
| Hardcoded secret key | Not tested | Not reached: GitHub push protection blocked it first (B6) |

**Takeaway:** each layer caught something the others missed: tests, CI, the
local gate, the cloud edition's taint and workflow analysis, GitHub push
protection, and human review. No single tool covered everything.
