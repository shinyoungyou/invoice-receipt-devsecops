# Backend 1 invoices and currency conversion

Owner: **Member 2**. Branch: `feature/backend-invoices`.
Member 2 owns implementation, tests and CI for this feature area.

## Scope and handoff

Maintain validation and calculation functions, implement invoice creation/list/detail/search
with SQLite transactions and parameterized queries, and add the Bank of Canada
CAD-to-USD display endpoint. Currency estimates include a rate date and never
change CAD checkout amounts. Keep rate failures independent of checkout.

Provide Member 1 with stable invoice/conversion request, response and error shapes.
Provide Member 3 with shared invoice lookup and payment-relevant data; Member 3
owns checkout, marking paid and receipt generation. Coordinate schema changes.

Existing Commit 1 code and tests transfer to this feature area without rewriting
Git history. The numbered commit references below describe that supplied package.


Commit 1 supplies pure functions only. POST /api/invoices and persistence arrive
in Commit 2; the current HTTP app still returns 404 for that endpoint.

## Proposed create request

```json
{
  "sellerName": "Demo Donair Shop",
  "customerName": "Demo Customer",
  "currency": "CAD",
  "taxRateBps": 500,
  "items": [
    { "description": "Chicken donair", "quantity": 2, "unitPriceCents": 1299 },
    { "description": "French fries", "quantity": 1, "unitPriceCents": 499 },
    { "description": "Bottled water", "quantity": 2, "unitPriceCents": 250 }
  ]
}
```

Currency may be omitted and defaults to CAD. All other fields above are required.
Tax is explicitly 0 or 500 basis points (0% or 5%) for this demo; these are
illustrative rates, not real-world tax advice. Expand the allowlist only when the
team agrees on additional rates. Existing output samples include server-owned
fields and must not be sent unchanged as create requests.

## Usage in the future route

```js
import { validateInvoiceInput } from './invoices/validation.js';
import { calculateInvoiceTotals } from './invoices/totals.js';

const input = validateInvoiceInput(req.body);
const totals = calculateInvoiceTotals(input.items, input.taxRateBps);
// Commit 2 will persist { ...input, ...totals } within a transaction.
```

The input validator trims strings, returns a new object and rejects unknown fields,
including IDs, timestamps, payment status and browser-calculated totals. It does
not coerce strings into numbers. Names allow 1–200 trimmed characters, descriptions
1–500, invoices 1–100 items, and quantities 1–1,000,000. Prices must be nonnegative
safe integers in cents. Zero totals are valid invoices; checkout must reject them.

The calculation function independently validates items and tax, adds lineTotalCents
to copied items, and returns items, subtotalCents, taxRateBps, taxCents and totalCents.
It uses BigInt internally and returns JSON-safe numbers only after range checks.
Tax is rounded half up once on the subtotal:

    taxCents = (subtotalCents * taxRateBps + 5000) / 10000

The formula uses integer division internally. For the example, subtotal is 3597,
tax is 180 and total is 3777 cents. A product, subtotal or final total above
Number.MAX_SAFE_INTEGER is rejected; numeric input validation alone cannot detect
these calculated overflows. Always run both functions before persistence.

Errors are InvoiceValidationError objects with code INVALID_INVOICE, statusCode
400, field and message. Commit 2 must map these to a JSON HTTP 400 response; this
commit does not change Express error handling. Do not send internal exceptions to
clients. Coordinate this request format and error mapping with Members 1 and 3 and copy
the agreed details into the repository's central docs/api-contract.md.

Run `npm test` from backend/. The invoice tests cover validation, tampered fields,
tax boundaries, input immutability and monetary overflow. Existing health and
SQLite tests are also discovered automatically.

## Tests and DevOps owned by Member 2

Keep the calculation and validation tests and add invoice creation atomicity,
list/detail/search behavior, invalid inputs and conversion cases. Test rate
direction, dated output, rounding and unavailable-rate fallback with fixtures.
Mock the rate API in CI and use isolated test databases. Review Member 3's
payment interaction with invoice records and jointly test the integrated flow.

Maintain backend-core-ci.yml and shared database initialization checks. Coordinate
backend package/script/migration edits with Member 3. Coordinate the single
repository-wide SonarQube setup, while each member owns their feature's coverage
and findings. Produce a confirmed SonarQube finding/fix demonstration. Member 3
coordinates CodeQL; fix CodeQL findings in invoice/conversion code yourself.
