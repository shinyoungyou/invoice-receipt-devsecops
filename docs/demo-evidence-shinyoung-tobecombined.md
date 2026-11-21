# Member 1 demo evidence (to be combined)

Working notes for Member 1 (frontend). These entries follow the template in
[`demo-evidence-example.md`](demo-evidence-example.md) and will be merged into
[`demo-evidence.md`](demo-evidence.md) before the final PR.

Lines marked **TODO** are still to be captured. Do not present them as results
until they are filled in from real runs.

Screenshots and logs go in `docs/evidence/` with the `m1-` prefix.

## Summary: from first failure to passing gate

All scans used a local SonarQube Community Build (v26.11) with project
`invoice-frontend-dev`. All CI runs are the **Frontend checks** job on
`feature/frontend`.

| # | When | What ran | Result | Entry |
| --- | --- | --- | --- | --- |
| 1 | Nov 19, 12:33 | First SonarQube scan of `2401950` | **Finding.** 4 open issues (3 × `javascript:S9383`, 1 × `javascript:S7773`), Reliability C. The gate passed because a first analysis has no new code to judge | E01 |
| 2 | Nov 19, 13:27 | Local tests before the fix | **Failure.** The 4 new regression tests failed against the unfixed source, with 4 unhandled rejections | E01 |
| 3 | Nov 19, 13:27 | Frontend CI on `f8d5a4c` | **Failure.** The commit contained only the tests; the source fix was still in `git stash`. 4 failed, 133 passed | E02 |
| 4 | **TODO** | Frontend CI on the follow-up commit (**TODO** hash) | **TODO**, expected green | E02 |
| 5 | Nov 21, 1:43 PM | Second SonarQube scan, after the follow-up commit | **Quality gate failed.** The fix introduced 1 new `S9383` issue (`invoice-list.js:94`). "New issues" was 1, and the gate requires 0 | E03 |
| 6 | **TODO** | Commit 11b (**TODO** hash), then the third scan | **TODO**, expected: gate passed, 0 new issues, Reliability A | E03 |

The story in one sentence: SonarQube found a reliability risk, the tests
reproduced it, CI caught an incomplete fix commit, and the quality gate caught
a new issue introduced by the fix itself, before any of it reached `main`.

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

- `docs/evidence/m1-sonar-first-scan.png`: dashboard with Reliability C and 4 issues
- `docs/evidence/m1-sonar-issue-list.png`: all four issues
- `docs/evidence/m1-sonar-s9383-main-js.png`: issue detail with rule ID and line 55
- `docs/evidence/m1-sonar-s7773-form.png`: **TODO**, if it was captured before the second scan
- `docs/evidence/m1-tests-before-fix.png`: **TODO**, if the terminal output is still available. The 4 new regression tests run against the unfixed source with `git stash push -- frontend/src`. Result: 4 failed, 133 passed, 4 unhandled errors

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
- **TODO** follow-up commit hash: source changes
- **TODO** 11b commit hash: corrects a new issue the fix introduced (see E03)

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

## Evidence E03 — Quality gate failed on a new issue introduced by the fix

| Field | Actual value |
| --- | --- |
| Member and feature | Member 1. Invoice list retry and Load more (`frontend/src/views/invoice-list.js`) |
| Date and branch | November 21, 2026, `feature/frontend` |
| Failing commit / PR | The E02 follow-up commit (**TODO** hash) |
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

- `docs/evidence/m1-sonar-gate-failed-new-code.png`: New Code tab with the gate Failed, "New issues 1, Required = 0", coverage 95.7%
- `docs/evidence/m1-sonar-s9383-list-l94.png`: issue detail at `invoice-list.js:94`, with rule `javascript:S9383`

**Fix or review decision:**

Commit 11b (**TODO** hash), `fix: stop returning the retry promise from
loadPageSafely`. `loadPageSafely` became a function that returns nothing:

```js
function loadPageSafely(offset) {
  loadPage(offset).catch(err => showUnexpectedError(results, err));
}
```

Callers no longer receive a promise, so nothing is left unhandled. Behavior is
unchanged, and all 137 tests pass.

**Verification:**

- Local: `npm test` in `frontend/` reports 137 passed, 0 failed on 11b
- Third scan: **TODO**, the date and results. Expected: gate Passed, 0 new issues
- Overall code: **TODO**. Expected: Reliability A and 0 open issues, compared with C and 4 in E01
- Fixed issues: **TODO**. The issue list filtered by status Fixed, `http://localhost:9000/project/issues?id=invoice-frontend-dev&issueStatuses=FIXED`, expected to list the 4 original issues and this one

**After evidence:**

- `docs/evidence/m1-sonar-gate-passed-new-code.png`: **TODO**
- `docs/evidence/m1-sonar-overall-after.png`: **TODO**
- `docs/evidence/m1-sonar-fixed-issues.png`: **TODO**

**Presentation talking points:**

1. **What went wrong:** my fix for one finding introduced a new finding of the same rule.
2. **How it was revealed:** the quality gate's "no new issues" condition. This was the first time the gate had new code to judge.
3. **What changed:** a one-line refactor so the helper returns nothing.
4. **What shows the outcome:** gate Failed, then Passed, with the issue moving to Fixed.
5. **What it did not prove:**
   - The flagged promise could not actually reject, so the finding was about clarity more than a live bug.
   - The local gate does not block merges; the team's CI gate on `main` does.
