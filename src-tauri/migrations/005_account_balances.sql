-- Add balance columns to accounts table for storing API-reported balances
ALTER TABLE accounts ADD COLUMN balance_cents INTEGER;
ALTER TABLE accounts ADD COLUMN balance_available_cents INTEGER;
ALTER TABLE accounts ADD COLUMN balance_updated_at TEXT;
