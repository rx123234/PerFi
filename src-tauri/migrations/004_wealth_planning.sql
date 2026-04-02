BEGIN;

CREATE TABLE IF NOT EXISTS assets (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    asset_type      TEXT NOT NULL,
    institution     TEXT,
    current_value_cents INTEGER NOT NULL DEFAULT 0,
    ticker          TEXT,
    shares          REAL,
    cost_basis_cents INTEGER,
    purchase_price_cents INTEGER,
    purchase_date   TEXT,
    tax_treatment   TEXT,
    contribution_ytd_cents INTEGER DEFAULT 0,
    contribution_limit_cents INTEGER,
    notes           TEXT,
    is_manual       INTEGER DEFAULT 1,
    linked_account_id TEXT REFERENCES accounts(id),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS liabilities (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    liability_type  TEXT NOT NULL,
    institution     TEXT,
    current_balance_cents INTEGER NOT NULL DEFAULT 0,
    original_balance_cents INTEGER,
    interest_rate   REAL,
    minimum_payment_cents INTEGER,
    monthly_payment_cents INTEGER,
    payment_day     INTEGER,
    maturity_date   TEXT,
    linked_account_id TEXT REFERENCES accounts(id),
    notes           TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id              TEXT PRIMARY KEY,
    snapshot_date   TEXT NOT NULL,
    total_assets_cents   INTEGER NOT NULL,
    total_liabilities_cents INTEGER NOT NULL,
    net_worth_cents INTEGER NOT NULL,
    breakdown_json  TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nw_snapshots_date
    ON net_worth_snapshots(snapshot_date);

CREATE TABLE IF NOT EXISTS budgets (
    id              TEXT PRIMARY KEY,
    category_id     TEXT NOT NULL REFERENCES categories(id),
    monthly_limit_cents INTEGER NOT NULL,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_category
    ON budgets(category_id) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS savings_targets (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    target_type     TEXT NOT NULL,
    target_value    REAL NOT NULL,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goals (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    goal_type       TEXT NOT NULL,
    target_cents    INTEGER NOT NULL,
    current_cents   INTEGER NOT NULL DEFAULT 0,
    monthly_contribution_cents INTEGER DEFAULT 0,
    target_date     TEXT,
    priority        INTEGER DEFAULT 0,
    linked_asset_id TEXT REFERENCES assets(id),
    icon            TEXT,
    color           TEXT,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS retirement_profile (
    id                    TEXT PRIMARY KEY DEFAULT 'default',
    current_age           INTEGER NOT NULL,
    retirement_age        INTEGER NOT NULL DEFAULT 65,
    life_expectancy       INTEGER NOT NULL DEFAULT 90,
    annual_income_cents   INTEGER,
    income_growth_rate    REAL DEFAULT 0.03,
    ss_monthly_benefit_cents INTEGER,
    ss_claiming_age       INTEGER DEFAULT 67,
    retirement_spending_rate REAL DEFAULT 0.80,
    inflation_rate        REAL DEFAULT 0.03,
    pre_retirement_return REAL DEFAULT 0.07,
    post_retirement_return REAL DEFAULT 0.05,
    withdrawal_rate       REAL DEFAULT 0.04,
    effective_tax_rate    REAL DEFAULT 0.22,
    state                 TEXT,
    filing_status         TEXT DEFAULT 'single',
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS retirement_scenarios (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    description           TEXT,
    overrides_json        TEXT NOT NULL,
    result_json           TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tax_events (
    id              TEXT PRIMARY KEY,
    tax_year        INTEGER NOT NULL,
    event_type      TEXT NOT NULL,
    amount_cents    INTEGER NOT NULL,
    description     TEXT,
    asset_id        TEXT REFERENCES assets(id),
    is_short_term   INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tax_events_year ON tax_events(tax_year);

CREATE TABLE IF NOT EXISTS insights (
    id              TEXT PRIMARY KEY,
    insight_type    TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    severity        TEXT DEFAULT 'info',
    data_json       TEXT,
    is_read         INTEGER DEFAULT 0,
    is_dismissed    INTEGER DEFAULT 0,
    expires_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);

COMMIT;
