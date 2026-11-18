# Invoice and receipt API contract

The local Express server defaults to `http://127.0.0.1:3000/api`. Send JSON
requests with `Content-Type: application/json`. Monetary amounts use integer
cents. Member 2 owns invoice and conversion endpoints.

## Create an invoice

`POST /api/invoices`

```json
{
  "sellerName": "Demo Donair Shop",
  "customerName": "Demo Customer",
  "taxRateBps": 500,
  "items": [
    { "description": "Chicken donair", "quantity": 2, "unitPriceCents": 1299 }
  ]
}
```

Both names must contain 1–200 characters after trimming. Supply 1–100 items
with a trimmed description of 1–500 characters, an integer quantity from 1
through 1,000,000 and a nonnegative safe integer price. `currency` is optional
and defaults to `CAD`, the only accepted value. `taxRateBps` is required and
accepts 0 or 500. Extra fields at either level produce a validation error.

The server adds line amounts, rounds tax half up once on the subtotal, and
checks every monetary result fits a JavaScript safe integer. A zero-total
invoice is valid. For the example above the subtotal is 2598 cents, tax is 130
cents and the total is 2728 cents.

Success returns HTTP 201, a `Location` header pointing to the detail endpoint
and the full unpaid invoice. See [complete response examples](sample-invoice.json).
Treat IDs and invoice numbers as opaque strings. Timestamps are UTC ISO strings.

## Read and search

`GET /api/invoices/:id` returns HTTP 200 with the full invoice and ordered
items. `status`, `updatedAt` and `paidAt` reflect the stored payment state.
`receiptUrl` is null while unpaid and is `/api/invoices/:id/receipt` when paid.

`GET /api/invoices?q=donair&limit=50&offset=0` returns HTTP 200 and an array
of invoice summaries with the same fields as detail except for `items`. The
default limit is 50, the maximum is 100 and the default offset is 0. Results
are newest first, breaking ties by descending ID. The optional trimmed `q`
matches a literal substring in the invoice number, seller name or customer
name using SQLite's ASCII case folding. An empty result is `[]`.

## Estimate the total in USD

`GET /api/invoices/:id/conversion?currency=USD` returns HTTP 200 with a dated
display estimate. USD is the default and the only supported target. For an
illustrative rate of 1.2500 CAD per USD, the response for the example above is

```json
{
  "invoiceId": "inv_demo_001",
  "currency": "CAD",
  "totalCents": 2728,
  "estimatedCurrency": "USD",
  "estimatedTotalCents": 2182,
  "cadPerUsd": "1.2500",
  "rateDate": "2026-11-09",
  "source": "Bank of Canada"
}
```

The server divides CAD cents by the published `FXUSDCAD` rate and rounds half
up to the nearest USD cent. Display “Estimated USD equivalent — charged in CAD.”
If the rate service is unavailable, the UI can continue with the stored CAD
invoice. [Bank of Canada daily exchange rates](https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/)

## Errors

Errors use `{"error":{"code":"…","message":"…"}}`. Invalid invoice input also
includes a `field`, for example `items[0].quantity`.

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_INVOICE` | Invalid or unexpected invoice field, or a calculated amount exceeds the safe range |
| 400 | `INVALID_QUERY` | Unsupported conversion currency or invalid list parameters |
| 400 / 413 | `INVALID_JSON` / `BODY_TOO_LARGE` | Malformed JSON or request exceeds the server body limit |
| 404 | `INVOICE_NOT_FOUND` | No invoice with that ID |
| 422 | `ESTIMATE_OUT_OF_RANGE` | Converted USD amount exceeds the safe integer range |
| 503 | `RATE_UNAVAILABLE` | Bank of Canada returned no usable rate or the request timed out |

## Payment and receipt handoff

Member 3 owns these planned endpoints. The backend README calls the checkout
endpoint `POST /api/invoices/:id/checkout`. The earlier proposed contract called
it `/payment-link` with a JSON response containing `invoiceId`, `paymentUrl`
and `status`. Confirm the final checkout contract with Member 3 before wiring the UI.
Checkout uses Stripe test mode and the stored CAD amount.

`POST /api/webhooks/stripe` verifies the signature, invoice identity, expected
amount, currency and successful payment. Repeated deliveries must be safe.
Payment failures leave an unpaid invoice unpaid.

`GET /api/invoices/:id/receipt` serves a paid PDF as `application/pdf`. An
unpaid invoice returns HTTP 409. Apply appropriate invoice access controls
before exposing this demo beyond a controlled environment.
