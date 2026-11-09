# Demo evidence examples

Use these examples to record development problems and fixes for the final
presentation. **All entries below are illustrative, not evidence of actual project
failures or scan results.** Replace placeholders with your own observations.

Keep this file as a reference. Add real entries to `docs/demo-evidence.md`.
Capture failures before fixing them and save the passing rerun afterward.

## Ownership

| Member | Record examples from |
| --- | --- |
| Member 1 | Frontend forms, invoice display, API integration, UI tests and frontend CI |
| Member 2 | Invoice validation/calculations, SQLite, currency conversion and backend-core CI |
| Member 3 | Checkout, webhooks, payment state, receipts and payment CI |

Each member should contribute at least one meaningful before-and-after example.
The team should also prepare its planned SonarQube and CodeQL demonstrations.
Not every member needs a finding from both scanners. Do not introduce bugs into
main to produce evidence; use a clearly labeled disposable sample when needed.

## Example 1 — Failed tax calculation test

**Illustrative scenario only.** The existing calculation implementation already
rounds tax once on the subtotal; this example describes a hypothetical regression.

| Field | Example entry |
| --- | --- |
| Member / feature | Member 2 — Invoice calculations |
| Date / branch | `<actual date>` / `<actual branch>` |
| Tool / command | Node test runner / `npm test` inside backend/ |
| Test | `rounds half up once on the subtotal` |
| Initial commit / CI run | `<commit link>` / `<run link>` |
| Type | Calculation bug; not a scanner finding |

### Failure and impact

Two items cost 10 cents each, with a 5% demo tax rate. The subtotal is 20 cents,
so invoice-level tax should be 1 cent and the total should be 21 cents.
A faulty implementation rounds tax on each item separately: each half-cent rounds
to 1 cent, producing 2 cents of tax and a 22-cent total.

Illustrative failure summary, not copied test output:

```text
Test: rounds half up once on the subtotal
Expected taxCents: 1
Actual taxCents:   2
```

### Cause and fix

The implementation rounded each line's tax before summing it. The fix sums line
totals first, then calculates and rounds tax once on the subtotal, following the
agreed contract. Use exact integer arithmetic for the intermediate calculation.

- Before screenshot or log: `<relative evidence path or attachment link>`
- Fix commit / PR: `<link>`
- Passing rerun: `<run link and screenshot/log>`
- Actual result: `<record the observed result; do not assume it passed>`

### Presentation explanation

“Our test caught a one-cent overcharge caused by rounding tax on each item. We
changed the calculation to round once on the subtotal and reran the test. This
shows why business-rule tests are needed alongside static analysis.”

## Example 2 — SonarQube finding

**Illustrative structure only.** Use a finding that your selected SonarQube setup
actually reports. This example assumes duplicated validation logic was reported;
it does not assert that the project currently has this finding or name a rule ID.

| Field | Fill in from the actual scan |
| --- | --- |
| Member / feature | `<member and owned feature>` |
| Date / branch / commit | `<values>` |
| Tool | `<SonarQube product/edition and relevant configuration>` |
| Finding title | `<exact title from the scan>` |
| Rule ID / reported classification / severity | `<exact values, or not applicable>` |
| File and location | `<actual file and line>` |
| Scan link | `<link>` |
| Quality gate result | `<passed/failed/not configured>` |
| Did it block merge/release? | `<yes/no, with the actual check or rule>` |

### Finding and impact

Hypothetical example: repeated validation logic makes it easier for two routes to
apply different quantity limits. Describe the real issue in your own code and
why it matters. A maintainability finding is not automatically a vulnerability.

### Review and fix

Record whether the finding was valid. If valid, describe the smallest appropriate
fix and its commit. In this hypothetical example, shared validation could replace
duplicated logic while preserving existing behavior.

- Original finding screenshot: `<path or link>`
- Fix commit / PR: `<link>`
- Tests run to check behavior: `<commands and observed outcomes>`
- Rescan result: `<resolved/still reported/other actual state>`
- Quality gate after rerun: `<actual result>`
- After screenshot / scan link: `<path or link>`

If the team decides no code change is needed, record the review rationale and
actual finding status. Do not describe it as fixed or resolved without evidence.

### Presentation explanation

“SonarQube reported [actual issue]. We reviewed it and found [actual impact]. We
changed [specific code], checked behavior with [tests], and rescanned. The result
was [observed result].”

## Example 3 — Payment or receipt test failure

**Illustrative scenario only.** This describes a possible test during Member 3's
implementation; it is not a claim that the receipt endpoint already exists.

| Field | Example entry |
| --- | --- |
| Member / feature | Member 3 — Paid receipt access |
| Test | `<actual test name for unpaid receipt rejection>` |
| Initial behavior | Hypothetically, an unpaid invoice receives HTTP 200 and a PDF |
| Expected behavior | Reject the request with the agreed API error response |
| Risk | Issuing a receipt that incorrectly implies payment was completed |

Record the database fixture status, endpoint response and failing assertion.
Explain how the handler was changed to check stored payment state before rendering
the PDF. Verify both unpaid rejection and successful paid receipt download.

- Failure evidence: `<path or link>`
- Cause: `<actual cause>`
- Fix commit / PR: `<link>`
- Passing unpaid and paid test evidence: `<path or link>`
- Lesson: Payment state must come from the backend's verified records, not the
  browser return URL.

## Template for a real entry

Copy this section into `docs/demo-evidence.md` for each meaningful example.
Do not copy illustrative results as if they happened.

### Evidence E01 — <short descriptive title>

| Field | Actual value |
| --- | --- |
| Member and feature | |
| Date and branch | |
| Failing commit / PR | |
| Tool and command or scan configuration | |
| Test name or scanner rule/query ID | |
| Reported classification and severity, if applicable | |
| Failure / finding / warning message | |
| Expected behavior | |
| Observed behavior | |
| CI or scan link | |
| Did it actually block merge or release? How? | |

**Cause and impact:**

<Explain what caused the result and why it mattered. Distinguish a product bug,
security concern, maintainability issue, environment problem and false positive.>

**Before evidence:**

<Screenshot or short log excerpt, with the command and commit that produced it.>

**Fix or review decision:**

<Describe the change and link the commit/PR. If no fix is appropriate, explain why.>

**Verification:**

<Record the rerun command, commit, CI/scan link and observed result. Include
regression tests where relevant. A scan finishing successfully does not by itself
prove the finding disappeared or that the quality gate passed.>

**After evidence:**

<Screenshot/log showing the passing test, resolved finding or actual reviewed state.>

**Presentation talking points:**

1. What went wrong or was reported?
2. How did the test/tool reveal it?
3. What did we change or decide?
4. What evidence shows the outcome?
5. What did this check not prove?

## Evidence handling checklist

- Capture the initial failure before changing the code.
- Keep the test name or exact scanner rule/query ID and source commit.
- Use filenames such as `member2-tax-rounding-before.png` and
  `member2-tax-rounding-after.png`; store screenshots under `docs/evidence/` if
  appropriate, or link to retained CI artifacts.
- Save important artifacts before their retention period expires.
- Remove tokens, Stripe secrets, personal information and unrelated private data.
- Do not treat an expected SQLite ExperimentalWarning as a security vulnerability
  or a failed test. It can be documented as an environment note if relevant.
- For CodeQL evidence, use the same template and record the real query ID, alert
  location, review decision and result of the follow-up analysis.
- Rehearse with real evidence. Clearly label any deliberately unsafe disposable
  demonstration sample and keep it out of stable application code.
