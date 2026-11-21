# Member 1 demo evidence (to be combined)

Working notes for Member 1 (frontend). These entries follow the template in
[`demo-evidence-example.md`](demo-evidence-example.md) and will be merged into
[`demo-evidence.md`](demo-evidence.md) before the final PR.

Lines marked **TODO** are still to be captured. Do not present them as results
until they are filled in from real runs.

Screenshots and logs go in `docs/evidence/` with the `m1-` prefix.

## Evidence E01 — SonarQube found unhandled promises in the frontend

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

- `docs/evidence/m1-sonar-first-scan.png`: dashboard with Reliability C and 4 issues
- `docs/evidence/m1-sonar-issue-list.png`: all four issues
- `docs/evidence/m1-sonar-s9383-main-js.png`: issue detail with rule ID and line 55
- `docs/evidence/m1-sonar-s7773-form.png`: **TODO** (must be taken before the rescan)
- `docs/evidence/m1-tests-before-fix.png`: **TODO**, if the terminal output is still available. The four new regression tests run against the unfixed source with `git stash push -- frontend/src`. Result: 4 failed, 133 passed, 4 unhandled errors

**Fix or review decision:**

Fix all four. The change touched three areas:

- **`main.js`:** `render()` catches unexpected errors and shows "Something went wrong while showing this page. Reload to try again." The first-load and `popstate` calls are marked `void` because `render()` now handles its own errors.
- **Retry and Load more buttons:** in `invoice-detail.js` and `invoice-list.js`, these route unexpected errors to the same message through a shared `showUnexpectedError` helper in `shared.js`.
- **`invoice-form.js`:** uses `Number.NaN`.

Four regression tests feed malformed server data (`items: null`, non-integer
`totalCents`) and check that the message appears instead of an endless
loading state.

The fix landed in two commits; see E02:

- `f8d5a4c`: regression tests only, by mistake
- **TODO** follow-up commit hash: source changes

**Verification:**

- Local: `npm test` in `frontend/` reports 137 passed, 0 failed on the fixed source. **TODO:** confirm on the follow-up commit.
- CI: **TODO**, the Frontend CI run link for the follow-up commit (green).
- Rescan: **TODO**, the date and results. Expected: the S9383 and S7773 issues closed, Reliability A, and the gate passed on new code.

**After evidence:**

- `docs/evidence/m1-sonar-after-dashboard.png`: **TODO**
- `docs/evidence/m1-sonar-after-closed-issues.png`: **TODO** (Issues filtered to Closed)

**Presentation talking points:**

1. **What was reported:** SonarQube flagged async calls whose errors had nowhere to go, plus a convention issue Member 2 also had.
2. **How it was found:** a local scan before merging. This was "shift left": fast feedback without overwriting the shared `main` dashboard, which Community Build analyzes as a single branch.
3. **What changed:** errors are now caught and shown, and regression tests reproduce the original failure.
4. **What shows the outcome:** before and after scans, tests that fail on the old code and pass on the new code, and a green CI run.
5. **What it did not prove:**
   - The local scan is advisory. The CI quality gate on `main` is the enforcement.
   - The rule missed two equivalent call sites.
   - Community Build does not detect injection vulnerabilities at all.

## Evidence E02 — CI caught an incomplete fix commit

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
| CI or scan link | **TODO**, the Frontend CI run URL for `f8d5a4c` |
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

- `docs/evidence/m1-ci-f8d5a4c-failed-tests.png`: **TODO**, the test list with the four `×` lines and `Tests  4 failed | 133 passed (137)`
- `docs/evidence/m1-ci-f8d5a4c-unhandled-rejection.png`: **TODO**, the `Unhandled Rejection` block ending in `render src/main.js:37:23`
- `docs/evidence/m1-ci-f8d5a4c-failed.log`: full log saved locally, because GitHub deletes Actions logs after the retention period

**Fix or review decision:**

The source changes were restored with `git stash pop`, verified locally with
137 tests passing, and pushed as a follow-up commit. The pushed commit was not
amended, to avoid force-pushing a shared branch.
Follow-up commit: **TODO**

**Verification:**

- **TODO**, the green Frontend CI run URL for the follow-up commit
- **TODO:** confirm `git grep -n "Number.NaN" HEAD -- frontend/src` finds the change

**After evidence:**

- `docs/evidence/m1-ci-followup-passed.png`: **TODO**

**Presentation talking points:**

1. **What went wrong:** the fix commit didn't contain the fix.
2. **How it was revealed:** CI ran the new regression tests against the code actually pushed, not the code on my laptop.
3. **What changed:** the source changes went in as a follow-up commit, without force-pushing.
4. **What shows the outcome:** a red run on `f8d5a4c` and a green run on the follow-up.
5. **What it did not prove:** CI only checks what the tests cover. It caught this because the regression tests were written first.
