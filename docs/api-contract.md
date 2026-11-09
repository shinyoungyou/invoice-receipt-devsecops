
# API Contract — Invoice & Receipt Generator

## Overview

The backend provides REST APIs for creating invoices,
retrieving invoice details, generating payment links,
and downloading receipts.

Base URL (development): http://localhost:4000/api

All monetary values are represented as integer cents
in CAD to avoid floating-point precision errors.

## Invoice Data Model

Example invoice:

```json
{
  "id": "inv_001",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "currency": "CAD",
  "items": [
    {
      "description": "Web Development",
      "quantity": 2,
      "unitPriceCents": 5000
    }
  ],
  "taxRateBasisPoints": 500,
  "subtotalCents": 10000,
  "taxCents": 500,
  "totalCents": 10500,
  "status": "unpaid"
}
```

The backend calculates and returns all totals.
Client-provided totals must not be trusted.

## API Endpoints

### 1. Create Invoice

POST /api/invoices

Request:
```json
{
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "items": [
    {
      "description": "Web Development",
      "quantity": 2,
      "unitPriceCents": 5000
    }
  ],
  "taxRateBasisPoints": 500
}
```

Response: 201 Created

Returns the created invoice object.

Validation:
- Customer name and email are required.
- At least one line item is required.
- Quantity must be a positive integer.
- Unit price must be a non-negative integer.
- Tax rate must be a supported non-negative integer.
- Calculations must not exceed safe integer limits.
- All totals are calculated by the backend.

### 2. Get Invoice

GET /api/invoices/:id

Response: 200 OK

Returns the requested invoice.

Response: 404 Not Found if the invoice does not exist.

### 3. Create Payment Link

POST /api/invoices/:id/payment-link

Response: 200 OK

Example:
```json
{
  "invoiceId": "inv_001",
  "paymentUrl": "https://checkout.stripe.com/example",
  "status": "unpaid"
}
```

The payment URL is generated using Stripe test mode.

The backend must use its stored invoice total rather
than accepting a payment amount from the client.

### 4. Stripe Webhook

POST /api/webhooks/stripe

Stripe sends payment events to this endpoint.

Requirements:
- Verify the Stripe webhook signature.
- Confirm the payment event matches the invoice.
- Confirm the expected amount and currency.
- Handle repeated webhook deliveries safely.
- Mark the invoice as paid only after verification.

### 5. Download Receipt

GET /api/invoices/:id/receipt

Response: 200 OK

Content-Type: application/pdf

Returns a PDF receipt for a paid invoice.

Response: 409 Conflict if the invoice is not paid.

## Invoice Status

- unpaid
- paid

Payment failures do not mark an invoice as paid.

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid invoice amount"
  }
}
```

## Security and Reliability

- Never trust client-provided totals.
- Use integer cents for monetary calculations.
- Validate all incoming data.
- Use parameterized database queries.
- Keep Stripe secret keys in environment variables.
- Verify Stripe webhook signatures.
- Prevent duplicate payment processing.
- Do not commit credentials or secrets.
- Apply appropriate invoice access controls before
  exposing this application beyond a controlled demo.

## Notes

This is the initial proposed API contract.
Changes affecting frontend and backend integration
must be discussed and documented before implementation.
