# Invoice and receipt API contract

The local Express server defaults to `http://127.0.0.1:3000/api`. Send JSON
requests with `Content-Type: application/json`. Monetary amounts use integer
cents. Member 2 owns invoice and conversion endpoints. Member 3 owns
[payments and receipts](#payments-and-receipts).

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

## Payments and receipts

Member 3 owns these endpoints. Payments use Stripe test mode and always charge
the stored CAD total. The browser return URL never marks an invoice paid; only a
verified Stripe webhook does.

### Start checkout

`POST /api/invoices/:id/checkout` takes no request body. Any amount the client
sends is ignored. A new Stripe Checkout Session returns HTTP 201. If the
invoice already has an open session, the same session returns HTTP 200.

```json
{
  "invoiceId": "inv_demo_001",
  "status": "unpaid",
  "checkoutSessionId": "cs_test_a1B2c3",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1B2c3",
  "currency": "CAD",
  "amountCents": 2728,
  "expiresAt": "2026-11-19T18:00:00.000Z"
}
```

Send the browser to `checkoutUrl`. Afterwards Stripe redirects to the
configured success or cancel URL, by default
`http://localhost:5173/invoices/:id?checkout=success` or `?checkout=cancelled`.
On return, refetch `GET /api/invoices/:id`. If it is still `unpaid` after a
success redirect, show a pending state and refetch after a short delay.

### Stripe webhook

`POST /api/webhooks/stripe` is called by Stripe, not the UI. It verifies the
`Stripe-Signature` header against the raw body, then checks the invoice ID,
payment mode, currency `cad` and the stored amount before marking the invoice
paid. Handled event types are `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
and `checkout.session.expired`. Success returns HTTP 200 with
`{"received":true,"result":"paid"}`. Other results are `already_paid`,
`unchanged`, `duplicate` and `ignored`. Repeated deliveries are safe. Failed or
expired payments leave an unpaid invoice unpaid.

### Download a receipt

`GET /api/invoices/:id/receipt` returns HTTP 200 with `application/pdf` and
`Content-Disposition: attachment; filename="receipt-<invoiceNumber>.pdf"`.
The PDF lists the seller, customer, invoice number, payment date in UTC, each
item with quantity, unit price and amount, the subtotal, tax and CAD total.
Use the `receiptUrl` from invoice detail; it is null until the invoice is paid.
Apply appropriate invoice access controls before exposing this demo beyond a
controlled environment.

### Payment errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| 404 | `INVOICE_NOT_FOUND` | No invoice with that ID (checkout, receipt or webhook) |
| 409 | `INVOICE_ALREADY_PAID` | Checkout requested for a paid invoice |
| 409 | `PAYMENT_PENDING` | Stripe completed the previous session; the webhook has not confirmed it yet |
| 409 | `INVOICE_NOT_PAID` | Receipt requested before payment was confirmed |
| 422 | `CHECKOUT_AMOUNT_UNSUPPORTED` | Total is below $0.50 (including zero) or above $999,999.99 CAD |
| 502 | `PAYMENT_PROVIDER_ERROR` | Stripe rejected or failed the checkout request |
| 503 | `PAYMENTS_UNAVAILABLE` | Stripe keys are not configured on the server |
| 400 | `INVALID_SIGNATURE` / `INVALID_EVENT` | Webhook only: bad signature, or an event without a consistent invoice ID |
| 422 | `PAYMENT_MISMATCH` | Webhook only: paid amount, currency or mode differs from the invoice |
