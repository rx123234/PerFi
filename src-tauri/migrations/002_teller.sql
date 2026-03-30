BEGIN;

-- plaid_credentials is intentionally dropped: Plaid is replaced by Teller.
-- Any stored Plaid credentials become irrelevant after this migration.
DROP TABLE IF EXISTS plaid_credentials;

CREATE TABLE IF NOT EXISTS teller_config (
    id          TEXT PRIMARY KEY,
    app_id      TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'development',
    cert_path   TEXT NOT NULL,
    key_path    TEXT NOT NULL
);

-- Rename Plaid columns on accounts
ALTER TABLE accounts RENAME COLUMN plaid_account_id   TO teller_account_id;
ALTER TABLE accounts RENAME COLUMN plaid_item_id      TO teller_enrollment_id;
ALTER TABLE accounts RENAME COLUMN plaid_access_token TO teller_access_token;
ALTER TABLE accounts RENAME COLUMN plaid_cursor       TO teller_last_tx_id;

-- Rename Plaid tx id on transactions
ALTER TABLE transactions RENAME COLUMN plaid_tx_id TO teller_tx_id;

-- Unique index for deduplicating accounts on re-enrollment
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_teller_id
    ON accounts(teller_account_id)
    WHERE teller_account_id IS NOT NULL;

COMMIT;
