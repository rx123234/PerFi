CREATE TABLE IF NOT EXISTS plaid_credentials (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL,
    secret      TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'development'
);

CREATE TABLE IF NOT EXISTS accounts (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    institution        TEXT,
    account_type       TEXT NOT NULL,
    plaid_account_id   TEXT,
    plaid_access_token TEXT,
    plaid_item_id      TEXT,
    plaid_cursor       TEXT,
    mask               TEXT,
    source             TEXT NOT NULL DEFAULT 'manual',
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL UNIQUE,
    parent_id TEXT REFERENCES categories(id),
    color     TEXT,
    icon      TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    id            TEXT PRIMARY KEY,
    account_id    TEXT NOT NULL REFERENCES accounts(id),
    date          TEXT NOT NULL,
    amount        REAL NOT NULL,
    description   TEXT NOT NULL,
    enriched_desc TEXT,
    category_id   TEXT REFERENCES categories(id),
    merchant      TEXT,
    plaid_tx_id   TEXT UNIQUE,
    import_hash   TEXT UNIQUE,
    source        TEXT NOT NULL,
    pending       INTEGER DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

CREATE TABLE IF NOT EXISTS category_rules (
    id          TEXT PRIMARY KEY,
    pattern     TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id),
    priority    INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS amazon_orders (
    id            TEXT PRIMARY KEY,
    order_id      TEXT NOT NULL,
    order_date    TEXT NOT NULL,
    item_name     TEXT NOT NULL,
    quantity      INTEGER,
    unit_price    REAL,
    total_price   REAL NOT NULL,
    category      TEXT,
    matched_tx_id TEXT REFERENCES transactions(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS costco_items (
    id            TEXT PRIMARY KEY,
    receipt_date  TEXT NOT NULL,
    item_name     TEXT NOT NULL,
    item_number   TEXT,
    quantity      INTEGER,
    price         REAL NOT NULL,
    matched_tx_id TEXT REFERENCES transactions(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default categories
INSERT OR IGNORE INTO categories (id, name, color, icon) VALUES
    ('cat-groceries', 'Groceries', '#4CAF50', NULL),
    ('cat-dining', 'Dining', '#FF9800', NULL),
    ('cat-gas', 'Gas & Fuel', '#607D8B', NULL),
    ('cat-shopping', 'Shopping', '#9C27B0', NULL),
    ('cat-subscriptions', 'Subscriptions', '#2196F3', NULL),
    ('cat-utilities', 'Utilities', '#795548', NULL),
    ('cat-housing', 'Housing', '#F44336', NULL),
    ('cat-transportation', 'Transportation', '#00BCD4', NULL),
    ('cat-entertainment', 'Entertainment', '#E91E63', NULL),
    ('cat-health', 'Health', '#8BC34A', NULL),
    ('cat-income', 'Income', '#4CAF50', NULL),
    ('cat-transfer', 'Transfer', '#9E9E9E', NULL),
    ('cat-uncategorized', 'Uncategorized', '#BDBDBD', NULL);

-- Seed common categorization rules
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority) VALUES
    ('rule-001', 'WHOLE FOODS', 'cat-groceries', 10),
    ('rule-002', 'TRADER JOE', 'cat-groceries', 10),
    ('rule-003', 'SAFEWAY', 'cat-groceries', 10),
    ('rule-004', 'KROGER', 'cat-groceries', 10),
    ('rule-005', 'WALMART', 'cat-groceries', 5),
    ('rule-006', 'TARGET', 'cat-shopping', 5),
    ('rule-007', 'COSTCO', 'cat-groceries', 5),
    ('rule-008', 'AMAZON', 'cat-shopping', 5),
    ('rule-009', 'AMZN', 'cat-shopping', 5),
    ('rule-010', 'NETFLIX', 'cat-subscriptions', 10),
    ('rule-011', 'SPOTIFY', 'cat-subscriptions', 10),
    ('rule-012', 'HULU', 'cat-subscriptions', 10),
    ('rule-013', 'DISNEY+', 'cat-subscriptions', 10),
    ('rule-014', 'APPLE.COM/BILL', 'cat-subscriptions', 10),
    ('rule-015', 'GOOGLE *', 'cat-subscriptions', 5),
    ('rule-016', 'SHELL', 'cat-gas', 10),
    ('rule-017', 'CHEVRON', 'cat-gas', 10),
    ('rule-018', 'EXXON', 'cat-gas', 10),
    ('rule-019', 'BP ', 'cat-gas', 10),
    ('rule-020', 'ARCO', 'cat-gas', 10),
    ('rule-021', 'UBER EATS', 'cat-dining', 10),
    ('rule-022', 'DOORDASH', 'cat-dining', 10),
    ('rule-023', 'GRUBHUB', 'cat-dining', 10),
    ('rule-024', 'MCDONALD', 'cat-dining', 10),
    ('rule-025', 'STARBUCKS', 'cat-dining', 10),
    ('rule-026', 'CHIPOTLE', 'cat-dining', 10),
    ('rule-027', 'UBER ', 'cat-transportation', 5),
    ('rule-028', 'LYFT', 'cat-transportation', 10),
    ('rule-029', 'COMCAST', 'cat-utilities', 10),
    ('rule-030', 'XFINITY', 'cat-utilities', 10),
    ('rule-031', 'AT&T', 'cat-utilities', 10),
    ('rule-032', 'VERIZON', 'cat-utilities', 10),
    ('rule-033', 'T-MOBILE', 'cat-utilities', 10),
    ('rule-034', 'PG&E', 'cat-utilities', 10),
    ('rule-035', 'ELECTRIC', 'cat-utilities', 5),
    ('rule-036', 'WATER BILL', 'cat-utilities', 5),
    ('rule-037', 'CVS', 'cat-health', 10),
    ('rule-038', 'WALGREENS', 'cat-health', 10),
    ('rule-039', 'PHARMACY', 'cat-health', 5),
    ('rule-040', 'CINEMA', 'cat-entertainment', 5),
    ('rule-041', 'AMC ', 'cat-entertainment', 10),
    ('rule-042', 'REGAL', 'cat-entertainment', 10),
    ('rule-043', 'PAYROLL', 'cat-income', 10),
    ('rule-044', 'DIRECT DEP', 'cat-income', 10),
    ('rule-045', 'SALARY', 'cat-income', 10),
    ('rule-046', 'VENMO', 'cat-transfer', 5),
    ('rule-047', 'ZELLE', 'cat-transfer', 10),
    ('rule-048', 'TRANSFER', 'cat-transfer', 3);
