-- Bootstrap schema v1. Later schema changes require a new migration.
CREATE TABLE invoices (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  seller_name TEXT NOT NULL CHECK (length(trim(seller_name)) > 0),
  customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) > 0),
  currency TEXT NOT NULL DEFAULT 'CAD' CHECK (currency = 'CAD'),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents BETWEEN 0 AND 9007199254740991),
  tax_rate_bps INTEGER NOT NULL CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  tax_cents INTEGER NOT NULL CHECK (tax_cents BETWEEN 0 AND 9007199254740991),
  total_cents INTEGER NOT NULL CHECK (total_cents BETWEEN 0 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  CHECK (total_cents = subtotal_cents + tax_cents),
  CHECK ((status = 'unpaid' AND paid_at IS NULL) OR
         (status = 'paid' AND paid_at IS NOT NULL))
) STRICT;

CREATE TABLE invoice_items (
  id INTEGER PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents BETWEEN 0 AND 9007199254740991),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents BETWEEN 0 AND 9007199254740991),
  CHECK (line_total_cents = quantity * unit_price_cents)
) STRICT;
CREATE INDEX invoice_items_invoice_id_idx ON invoice_items(invoice_id);
CREATE INDEX invoices_created_at_idx ON invoices(created_at);

CREATE TABLE processed_webhook_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL
) STRICT;
