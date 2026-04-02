# Wealth Planning Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform PerFi from an expense tracker into a comprehensive wealth planning platform with net worth tracking, budgets, goals, retirement projections (Monte Carlo), tax awareness, cash flow forecasting, and AI-powered behavioral insights.

**Architecture:** Tauri desktop app — Rust backend with SQLite, React 19 + TypeScript frontend with Tailwind CSS v4. All new features follow the existing pattern: SQL migration -> Rust models -> Rust commands -> TypeScript types -> TypeScript API wrapper -> React components. Navigation via icon rail in Layout.tsx.

**Tech Stack:** Rust (rusqlite, chrono, uuid, serde, rand), React 19, TypeScript, Tailwind CSS v4, Recharts, Lucide icons, date-fns

---

## File Structure

### Backend (Rust)

**New files to create:**
- `src-tauri/migrations/004_wealth_planning.sql` — All new tables
- `src-tauri/src/commands/net_worth.rs` — Asset/liability/snapshot CRUD + net worth summary
- `src-tauri/src/commands/budgets.rs` — Budget CRUD + spending status
- `src-tauri/src/commands/goals.rs` — Goal CRUD + projections
- `src-tauri/src/commands/retirement.rs` — Retirement profile + Monte Carlo projections
- `src-tauri/src/commands/insights.rs` — Insight CRUD + anomaly detection + data preparation
- `src-tauri/src/commands/forecasting.rs` — Cash flow forecasting
- `src-tauri/src/planning/mod.rs` — Planning module root
- `src-tauri/src/planning/monte_carlo.rs` — Monte Carlo simulation engine
- `src-tauri/src/planning/projections.rs` — Linear/compound growth projections
- `src-tauri/src/planning/tax_brackets.rs` — Federal tax bracket data

**Files to modify:**
- `src-tauri/src/models.rs` — Add all new model structs
- `src-tauri/src/commands/mod.rs` — Register new command modules
- `src-tauri/src/lib.rs` — Register new commands in invoke_handler + add planning module
- `src-tauri/src/db.rs` — Add migration 004 to run_migrations
- `src-tauri/Cargo.toml` — Add `rand` dependency

### Frontend (React/TypeScript)

**New files to create:**
- `src/components/NetWorth/NetWorthPage.tsx` — Net worth dashboard
- `src/components/NetWorth/AssetLiabilityForm.tsx` — Add/edit modal for assets & liabilities
- `src/components/NetWorth/NetWorthChart.tsx` — Net worth over time area chart
- `src/components/Budget/BudgetPage.tsx` — Budget targets and tracking
- `src/components/Budget/BudgetProgressBar.tsx` — Category budget gauge
- `src/components/Goals/GoalsPage.tsx` — Financial goals dashboard
- `src/components/Goals/GoalCard.tsx` — Goal progress card
- `src/components/Goals/GoalForm.tsx` — Create/edit goal modal
- `src/components/Retirement/RetirementPage.tsx` — Retirement planning with Monte Carlo
- `src/components/Retirement/ProjectionChart.tsx` — Monte Carlo fan chart
- `src/components/Retirement/ScenarioSliders.tsx` — What-if controls
- `src/components/Insights/InsightsPage.tsx` — Behavioral insights feed
- `src/components/Insights/InsightCard.tsx` — Individual insight display
- `src/components/Forecasting/ForecastPage.tsx` — Cash flow forecasting
- `src/components/ui/progress-ring.tsx` — Circular progress indicator (reused by goals, tax)
- `src/components/ui/slider.tsx` — Range slider component (reused by retirement)
- `src/components/ui/modal.tsx` — Modal dialog (reused by forms)

**Files to modify:**
- `src/lib/types.ts` — Add all new TypeScript interfaces
- `src/lib/api.ts` — Add all new API wrapper functions
- `src/App.tsx` — Add new routes
- `src/components/Layout.tsx` — Add new nav items
- `src/components/Dashboard/DashboardPage.tsx` — Add insights preview cards

---

## Task 1: Database Migration & Rust Dependencies

**Files:**
- Create: `src-tauri/migrations/004_wealth_planning.sql`
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add `rand` crate to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
rand = "0.8"
```

- [ ] **Step 2: Create migration 004_wealth_planning.sql**

Create `src-tauri/migrations/004_wealth_planning.sql` with the full schema from the design spec. This includes tables: `assets`, `liabilities`, `net_worth_snapshots`, `budgets`, `savings_targets`, `goals`, `retirement_profile`, `retirement_scenarios`, `tax_events`, `insights`.

```sql
BEGIN;

-- ══════════════════════════════════════════════
-- ASSETS & LIABILITIES (Net Worth)
-- ══════════════════════════════════════════════

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

-- ══════════════════════════════════════════════
-- BUDGETS
-- ══════════════════════════════════════════════

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

-- ══════════════════════════════════════════════
-- FINANCIAL GOALS
-- ══════════════════════════════════════════════

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

-- ══════════════════════════════════════════════
-- RETIREMENT PLANNING
-- ══════════════════════════════════════════════

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

-- ══════════════════════════════════════════════
-- TAX TRACKING
-- ══════════════════════════════════════════════

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

-- ══════════════════════════════════════════════
-- AI INSIGHTS
-- ══════════════════════════════════════════════

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
```

- [ ] **Step 3: Register migration 004 in db.rs**

Add after the `if !applied.contains(&3)` block in `src-tauri/src/db.rs:run_migrations`:

```rust
    if !applied.contains(&4) {
        let migration = include_str!("../migrations/004_wealth_planning.sql");
        conn.execute_batch(migration)
            .map_err(|e| format!("Failed to run migration 004: {}", e))?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [4],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;
        eprintln!("Applied migration 004_wealth_planning.sql");
    }
```

- [ ] **Step 4: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/migrations/004_wealth_planning.sql src-tauri/src/db.rs src-tauri/Cargo.toml
git commit -m "feat: add wealth planning database migration (assets, liabilities, budgets, goals, retirement, insights)"
```

---

## Task 2: Rust Models for All New Entities

**Files:**
- Modify: `src-tauri/src/models.rs`

- [ ] **Step 1: Add all new model structs to models.rs**

Append to the end of `src-tauri/src/models.rs`:

```rust
// ═══════════════════════════════════════════
// Net Worth Models
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: String,
    pub name: String,
    pub asset_type: String,
    pub institution: Option<String>,
    pub current_value_cents: i64,
    pub ticker: Option<String>,
    pub shares: Option<f64>,
    pub cost_basis_cents: Option<i64>,
    pub purchase_price_cents: Option<i64>,
    pub purchase_date: Option<String>,
    pub tax_treatment: Option<String>,
    pub contribution_ytd_cents: i64,
    pub contribution_limit_cents: Option<i64>,
    pub notes: Option<String>,
    pub is_manual: bool,
    pub linked_account_id: Option<String>,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Liability {
    pub id: String,
    pub name: String,
    pub liability_type: String,
    pub institution: Option<String>,
    pub current_balance_cents: i64,
    pub original_balance_cents: Option<i64>,
    pub interest_rate: Option<f64>,
    pub minimum_payment_cents: Option<i64>,
    pub monthly_payment_cents: Option<i64>,
    pub payment_day: Option<i32>,
    pub maturity_date: Option<String>,
    pub linked_account_id: Option<String>,
    pub notes: Option<String>,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetWorthSnapshot {
    pub id: String,
    pub snapshot_date: String,
    pub total_assets_cents: i64,
    pub total_liabilities_cents: i64,
    pub net_worth_cents: i64,
    pub breakdown_json: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetWorthSummary {
    pub total_assets: f64,
    pub total_liabilities: f64,
    pub net_worth: f64,
    pub prev_net_worth: Option<f64>,
    pub assets_by_type: Vec<AssetTypeTotal>,
    pub liabilities_by_type: Vec<LiabilityTypeTotal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetTypeTotal {
    pub asset_type: String,
    pub total: f64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiabilityTypeTotal {
    pub liability_type: String,
    pub total: f64,
    pub count: i64,
}

// ═══════════════════════════════════════════
// Budget Models
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Budget {
    pub id: String,
    pub category_id: String,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub monthly_limit_cents: i64,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetWithSpending {
    pub budget: Budget,
    pub spent_cents: i64,
    pub remaining_cents: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetStatus {
    pub budgets: Vec<BudgetWithSpending>,
    pub total_budgeted: f64,
    pub total_spent: f64,
    pub unbudgeted_spending: f64,
    pub savings_rate: f64,
    pub income: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavingsRatePoint {
    pub month: String,
    pub income: f64,
    pub spending: f64,
    pub savings_rate: f64,
}

// ═══════════════════════════════════════════
// Goal Models
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub id: String,
    pub name: String,
    pub goal_type: String,
    pub target_cents: i64,
    pub current_cents: i64,
    pub monthly_contribution_cents: i64,
    pub target_date: Option<String>,
    pub priority: i32,
    pub linked_asset_id: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub notes: Option<String>,
    pub status: String,
    pub completed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalWithProgress {
    pub goal: Goal,
    pub percentage: f64,
    pub projected_completion_date: Option<String>,
    pub on_track: bool,
    pub months_remaining: Option<i32>,
}

// ═══════════════════════════════════════════
// Retirement Models
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetirementProfile {
    pub current_age: i32,
    pub retirement_age: i32,
    pub life_expectancy: i32,
    pub annual_income_cents: Option<i64>,
    pub income_growth_rate: f64,
    pub ss_monthly_benefit_cents: Option<i64>,
    pub ss_claiming_age: i32,
    pub retirement_spending_rate: f64,
    pub inflation_rate: f64,
    pub pre_retirement_return: f64,
    pub post_retirement_return: f64,
    pub withdrawal_rate: f64,
    pub effective_tax_rate: f64,
    pub state: Option<String>,
    pub filing_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetirementProjection {
    pub success_probability: f64,
    pub median_portfolio_at_retirement: f64,
    pub monthly_retirement_income: f64,
    pub years_funded_median: f64,
    pub required_monthly_savings: f64,
    pub percentiles: Vec<ProjectionPercentile>,
    pub yearly_data: Vec<YearlyProjection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionPercentile {
    pub percentile: i32,
    pub portfolio_at_retirement: f64,
    pub years_funded: f64,
    pub monthly_income: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YearlyProjection {
    pub age: i32,
    pub year: i32,
    pub p10: f64,
    pub p25: f64,
    pub p50: f64,
    pub p75: f64,
    pub p90: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetirementScenario {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub overrides_json: String,
    pub result_json: Option<String>,
    pub created_at: String,
}

// ═══════════════════════════════════════════
// Tax Models
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContributionStatus {
    pub asset_id: String,
    pub asset_name: String,
    pub tax_treatment: String,
    pub contribution_ytd: f64,
    pub contribution_limit: f64,
    pub remaining: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxSummary {
    pub tax_year: i32,
    pub estimated_income: f64,
    pub estimated_deductions: f64,
    pub taxable_income: f64,
    pub estimated_federal_tax: f64,
    pub effective_rate: f64,
    pub marginal_bracket: String,
    pub filing_status: String,
    pub contributions: Vec<ContributionStatus>,
}

// ═══════════════════════════════════════════
// Insight Models
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Insight {
    pub id: String,
    pub insight_type: String,
    pub title: String,
    pub body: String,
    pub severity: String,
    pub data_json: Option<String>,
    pub is_read: bool,
    pub is_dismissed: bool,
    pub expires_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsightData {
    pub net_worth: Option<NetWorthSummary>,
    pub savings_rate: f64,
    pub spending_by_category: Vec<CategorySpending>,
    pub spending_trends: Vec<SpendingTrend>,
    pub anomalies: Vec<SpendingAnomaly>,
    pub milestones: Vec<MilestoneCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpendingTrend {
    pub category_name: String,
    pub current_month: f64,
    pub three_month_avg: f64,
    pub change_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpendingAnomaly {
    pub transaction_id: String,
    pub description: String,
    pub amount: f64,
    pub category_name: String,
    pub category_avg: f64,
    pub deviation_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MilestoneCheck {
    pub milestone_type: String,
    pub description: String,
    pub achieved: bool,
    pub value: f64,
}

// ═══════════════════════════════════════════
// Forecasting Models
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastPoint {
    pub month: String,
    pub projected_income: f64,
    pub projected_spending: f64,
    pub projected_net: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpcomingBill {
    pub merchant: String,
    pub expected_amount: f64,
    pub expected_date: String,
    pub category: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonalPattern {
    pub month: i32,
    pub month_name: String,
    pub avg_spending: f64,
    pub vs_annual_avg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtPayoffPlan {
    pub strategy: String,
    pub total_interest: f64,
    pub payoff_date: String,
    pub monthly_payment: f64,
    pub debts: Vec<DebtPayoffItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtPayoffItem {
    pub liability_id: String,
    pub name: String,
    pub current_balance: f64,
    pub interest_rate: f64,
    pub payoff_date: String,
    pub total_interest: f64,
    pub monthly_payments: Vec<DebtPayment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtPayment {
    pub month: String,
    pub payment: f64,
    pub principal: f64,
    pub interest: f64,
    pub remaining: f64,
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors (models are just structs, no logic yet).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/models.rs
git commit -m "feat: add wealth planning model structs (net worth, budgets, goals, retirement, tax, insights, forecasting)"
```

---

## Task 3: Net Worth Backend Commands

**Files:**
- Create: `src-tauri/src/commands/net_worth.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create net_worth.rs**

Create `src-tauri/src/commands/net_worth.rs` with full CRUD for assets and liabilities, plus net worth summary and snapshot commands. Pattern follows `accounts.rs`: use `State<'_, DbState>`, `#[tauri::command]`, `Result<T, String>`.

Key commands:
- `get_assets()` — SELECT all from assets table, ordered by asset_type then name
- `create_asset(name, asset_type, institution, current_value_cents, ...)` — INSERT with uuid
- `update_asset(id, ...)` — UPDATE by id
- `delete_asset(id)` — DELETE by id
- `get_liabilities()` — SELECT all from liabilities table
- `create_liability(name, liability_type, institution, current_balance_cents, ...)` — INSERT with uuid
- `update_liability(id, ...)` — UPDATE by id
- `delete_liability(id)` — DELETE by id
- `get_net_worth_summary()` — Compute totals from assets + liabilities, group by type, get prev month snapshot for comparison
- `get_net_worth_history(months: i32)` — SELECT from net_worth_snapshots
- `take_net_worth_snapshot()` — Compute current totals, INSERT/REPLACE into snapshots for today's date
- `sync_asset_from_account(asset_id)` — For linked assets, compute balance from transactions sum

- [ ] **Step 2: Register module in mod.rs**

Add `pub mod net_worth;` to `src-tauri/src/commands/mod.rs`.

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/net_worth.rs src-tauri/src/commands/mod.rs
git commit -m "feat: add net worth backend commands (assets, liabilities, snapshots)"
```

---

## Task 4: Budget Backend Commands

**Files:**
- Create: `src-tauri/src/commands/budgets.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create budgets.rs**

Key commands:
- `get_budgets()` — SELECT budgets JOIN categories, compute current month spending from transactions
- `set_budget(category_id, monthly_limit_cents)` — UPSERT: if active budget exists for category, update it; otherwise insert
- `delete_budget(id)` — DELETE or set is_active = 0
- `get_budget_status(month: String)` — For given month (YYYY-MM), return all budgets with spent amounts, plus income and savings rate
- `get_savings_rate_history(months: i32)` — For each of the last N months, compute income, spending, and savings_rate = (income - spending) / income
- `suggest_budgets()` — For each category, return 3-month average spending as a suggested budget amount

Spending per category per month: reuse the existing pattern from `dashboard.rs` — SUM(amount_cents) WHERE date BETWEEN month_start AND month_end AND category_id = X, excluding transfers.

- [ ] **Step 2: Register module**

Add `pub mod budgets;` to `src-tauri/src/commands/mod.rs`.

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/budgets.rs src-tauri/src/commands/mod.rs
git commit -m "feat: add budget backend commands (CRUD, status, savings rate, suggestions)"
```

---

## Task 5: Goals Backend Commands

**Files:**
- Create: `src-tauri/src/commands/goals.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create goals.rs**

Key commands:
- `get_goals()` — SELECT all goals, compute percentage and projected completion
- `create_goal(name, goal_type, target_cents, current_cents, monthly_contribution_cents, target_date, ...)` — INSERT
- `update_goal(id, ...)` — UPDATE
- `delete_goal(id)` — DELETE
- `update_goal_progress(id, current_cents)` — UPDATE current_cents, check if completed
- `get_goal_projection(id)` — Given current_cents, monthly_contribution, and target_cents: compute months_remaining = (target - current) / monthly_contribution, projected_date, on_track vs target_date
- `get_emergency_fund_target()` — Compute 6 * avg monthly spending from transactions

- [ ] **Step 2: Register module**

- [ ] **Step 3: Verify compilation & Commit**

---

## Task 6: Monte Carlo Simulation Engine

**Files:**
- Create: `src-tauri/src/planning/mod.rs`
- Create: `src-tauri/src/planning/monte_carlo.rs`
- Create: `src-tauri/src/planning/projections.rs`
- Create: `src-tauri/src/planning/tax_brackets.rs`
- Modify: `src-tauri/src/lib.rs` — add `mod planning;`

- [ ] **Step 1: Create planning module root**

`src-tauri/src/planning/mod.rs`:
```rust
pub mod monte_carlo;
pub mod projections;
pub mod tax_brackets;
```

- [ ] **Step 2: Create tax_brackets.rs**

Hardcode 2025/2026 federal tax brackets for all filing statuses. Provide a function `estimate_federal_tax(taxable_income: f64, filing_status: &str) -> f64` that walks the progressive brackets. Also provide `get_marginal_bracket(taxable_income: f64, filing_status: &str) -> String`.

Contribution limits as constants:
```rust
pub const LIMIT_401K_2025: i64 = 23_500_00; // cents
pub const LIMIT_401K_CATCHUP_2025: i64 = 7_500_00;
pub const LIMIT_IRA_2025: i64 = 7_000_00;
pub const LIMIT_IRA_CATCHUP_2025: i64 = 1_000_00;
pub const LIMIT_HSA_SINGLE_2025: i64 = 4_300_00;
pub const LIMIT_HSA_FAMILY_2025: i64 = 8_550_00;
pub const STANDARD_DEDUCTION_SINGLE_2025: i64 = 15_000_00;
pub const STANDARD_DEDUCTION_MFJ_2025: i64 = 30_000_00;
```

2025 federal brackets (single):
```
10%: $0 - $11,925
12%: $11,925 - $48,475
22%: $48,475 - $103,350
24%: $103,350 - $197,300
32%: $197,300 - $250,525
35%: $250,525 - $626,350
37%: $626,350+
```

- [ ] **Step 3: Create projections.rs**

Utility functions:
- `future_value(present_value: f64, rate: f64, years: i32) -> f64` — compound growth
- `monthly_savings_to_target(target: f64, current: f64, rate: f64, years: i32) -> f64` — required monthly savings
- `ss_benefit_at_age(fra_benefit: f64, claiming_age: i32, fra_age: i32) -> f64` — adjust SS benefit for early/late claiming

SS adjustment: -6.67%/year before FRA (first 36 months), -5%/year (months 37-60 before FRA). +8%/year after FRA up to age 70.

- [ ] **Step 4: Create monte_carlo.rs**

Core simulation function:

```rust
pub fn run_simulation(params: &SimulationParams, iterations: usize) -> SimulationResult
```

`SimulationParams`:
- current_portfolio: f64 (total retirement savings now)
- monthly_contribution: f64
- years_to_retirement: i32
- years_in_retirement: i32
- pre_retirement_return: f64 (mean annual)
- post_retirement_return: f64
- return_stddev: f64 (default 0.15 for stocks)
- inflation_rate: f64
- withdrawal_rate: f64
- ss_annual_benefit: f64

Algorithm:
1. For each iteration:
   a. Accumulation phase: for each year until retirement, draw annual return from log-normal distribution (mean=pre_ret_return, stddev=0.15), apply to portfolio, add annual contributions
   b. Distribution phase: for each year in retirement, draw return from log-normal (mean=post_ret_return, stddev=0.10), subtract annual withdrawal (inflation-adjusted), add SS benefit
   c. Record: portfolio value at retirement, year when portfolio hits 0 (if ever)
2. Sort results, compute percentiles (10, 25, 50, 75, 90)
3. Success probability = % of iterations where portfolio lasts through retirement

Use `rand` crate with `rand_distr::LogNormal` for return distributions.

Actually, simpler: use Normal distribution for log-returns:
```rust
use rand::thread_rng;
use rand::distributions::{Distribution};
use rand_distr::Normal;

let normal = Normal::new(mean_return, stddev).unwrap();
let annual_return = normal.sample(&mut rng);
let growth_factor = 1.0 + annual_return;
```

- [ ] **Step 5: Add `mod planning` to lib.rs**

- [ ] **Step 6: Add `rand_distr` to Cargo.toml**

```toml
rand_distr = "0.4"
```

- [ ] **Step 7: Verify compilation & Commit**

---

## Task 7: Retirement Backend Commands

**Files:**
- Create: `src-tauri/src/commands/retirement.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create retirement.rs**

Key commands:
- `get_retirement_profile()` — SELECT from retirement_profile WHERE id = 'default', return defaults if not found
- `save_retirement_profile(...)` — UPSERT into retirement_profile
- `run_retirement_projection(overrides_json: Option<String>)` — Load profile, compute current portfolio from retirement-type assets, run Monte Carlo, return RetirementProjection
- `get_required_savings_rate(target_age: i32)` — Binary search for monthly_contribution that achieves 80% success rate at target_age
- `get_ss_comparison()` — Return benefit amounts at 62, 67, 70 with break-even ages
- `save_retirement_scenario(name, overrides_json)` — Save scenario with cached results
- `get_retirement_scenarios()` — List all scenarios

- [ ] **Step 2: Register module, verify compilation, commit**

---

## Task 8: Insights & Forecasting Backend Commands

**Files:**
- Create: `src-tauri/src/commands/insights.rs`
- Create: `src-tauri/src/commands/forecasting.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create insights.rs**

Key commands:
- `get_insights(unread_only: bool)` — SELECT from insights, optionally filtered
- `dismiss_insight(id)` — UPDATE is_dismissed = 1
- `mark_insight_read(id)` — UPDATE is_read = 1
- `generate_insights()` — Analyze financial data and create insight records:
  - **Spending alerts**: For each category, compare current month to 3-month avg. If > 20% increase, create insight.
  - **Savings rate trend**: Compare current savings rate to 3-month trailing. If dropped > 5 points, alert.
  - **Lifestyle inflation**: Compare YoY income growth vs spending growth. If spending growth > income growth, alert.
  - **Milestones**: Check net worth against thresholds ($10k, $25k, $50k, $100k, $250k, $500k, $1M). If crossed and no existing milestone insight, create one.
  - **Anomalies**: Find transactions > 3x category's monthly average.
- `get_insight_data_for_ai()` — Compile comprehensive JSON snapshot for AI analysis (net worth, savings rate, trends, anomalies, goals progress, budget status). Returns as a structured JSON string that can be sent to an LLM.

- [ ] **Step 2: Create forecasting.rs**

Key commands:
- `get_cash_flow_forecast(months: i32)` — Project future months:
  - Income: avg of last 3 months recurring income
  - Fixed costs: from fixed costs analysis
  - Variable spending: category averages with seasonal adjustment
  - Confidence: starts at 0.9, decreases by 0.05 per month out
- `get_upcoming_bills(days: i32)` — From fixed costs data, predict next occurrence of each recurring merchant based on historical payment dates
- `get_seasonal_patterns()` — For each calendar month (1-12), compute avg spending across all years of data, compare to annual average
- `calculate_debt_payoff(strategy: String, extra_monthly_cents: i64)` — Simulate month-by-month debt payoff using avalanche or snowball strategy

- [ ] **Step 3: Register modules, verify compilation, commit**

---

## Task 9: Register All Backend Commands in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add all new commands to invoke_handler**

Add to the `tauri::generate_handler![]` macro in `src-tauri/src/lib.rs`:

```rust
// Net Worth
commands::net_worth::get_assets,
commands::net_worth::create_asset,
commands::net_worth::update_asset,
commands::net_worth::delete_asset,
commands::net_worth::get_liabilities,
commands::net_worth::create_liability,
commands::net_worth::update_liability,
commands::net_worth::delete_liability,
commands::net_worth::get_net_worth_summary,
commands::net_worth::get_net_worth_history,
commands::net_worth::take_net_worth_snapshot,
commands::net_worth::sync_asset_from_account,
// Budgets
commands::budgets::get_budgets,
commands::budgets::set_budget,
commands::budgets::delete_budget,
commands::budgets::get_budget_status,
commands::budgets::get_savings_rate_history,
commands::budgets::suggest_budgets,
// Goals
commands::goals::get_goals,
commands::goals::create_goal,
commands::goals::update_goal,
commands::goals::delete_goal,
commands::goals::update_goal_progress,
commands::goals::get_emergency_fund_target,
// Retirement
commands::retirement::get_retirement_profile,
commands::retirement::save_retirement_profile,
commands::retirement::run_retirement_projection,
commands::retirement::get_required_savings_rate,
commands::retirement::get_ss_comparison,
commands::retirement::save_retirement_scenario,
commands::retirement::get_retirement_scenarios,
// Insights
commands::insights::get_insights,
commands::insights::dismiss_insight,
commands::insights::mark_insight_read,
commands::insights::generate_insights,
commands::insights::get_insight_data_for_ai,
// Forecasting
commands::forecasting::get_cash_flow_forecast,
commands::forecasting::get_upcoming_bills,
commands::forecasting::get_seasonal_patterns,
commands::forecasting::calculate_debt_payoff,
```

- [ ] **Step 2: Verify full compilation**

Run: `cd src-tauri && cargo check`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register all wealth planning commands in Tauri invoke handler"
```

---

## Task 10: TypeScript Types & API Layer

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add all new TypeScript interfaces to types.ts**

Append all interfaces matching the Rust models: Asset, Liability, NetWorthSnapshot, NetWorthSummary, AssetTypeTotal, LiabilityTypeTotal, Budget, BudgetWithSpending, BudgetStatus, SavingsRatePoint, Goal, GoalWithProgress, RetirementProfile, RetirementProjection, ProjectionPercentile, YearlyProjection, RetirementScenario, ContributionStatus, TaxSummary, Insight, InsightData, SpendingTrend, SpendingAnomaly, MilestoneCheck, ForecastPoint, UpcomingBill, SeasonalPattern, DebtPayoffPlan, DebtPayoffItem, DebtPayment.

- [ ] **Step 2: Add all new API functions to api.ts**

One `invoke<T>()` wrapper per backend command. Follow existing pattern in api.ts.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/api.ts
git commit -m "feat: add TypeScript types and API wrappers for wealth planning features"
```

---

## Task 11: Shared UI Components (Modal, Slider, Progress Ring)

**Files:**
- Create: `src/components/ui/modal.tsx`
- Create: `src/components/ui/slider.tsx`
- Create: `src/components/ui/progress-ring.tsx`

- [ ] **Step 1: Create modal.tsx**

A simple modal overlay component using existing Tailwind patterns (bg-surface, border-border, text-foreground). Props: `isOpen`, `onClose`, `title`, `children`. Uses portal-free approach (positioned fixed). Closes on backdrop click and Escape key.

- [ ] **Step 2: Create slider.tsx**

A styled range input. Props: `min`, `max`, `step`, `value`, `onChange`, `label`, `formatValue` (for display). Shows current value label.

- [ ] **Step 3: Create progress-ring.tsx**

SVG circular progress indicator. Props: `percentage`, `size`, `strokeWidth`, `color`, `label`. Used by goals and tax contribution tracking. Renders SVG circle with stroke-dashoffset animation.

- [ ] **Step 4: Commit**

---

## Task 12: Net Worth Page (Frontend)

**Files:**
- Create: `src/components/NetWorth/NetWorthPage.tsx`
- Create: `src/components/NetWorth/AssetLiabilityForm.tsx`
- Create: `src/components/NetWorth/NetWorthChart.tsx`

- [ ] **Step 1: Create NetWorthChart.tsx**

Recharts AreaChart showing net worth over time. Takes `data: NetWorthSnapshot[]`. Stacked area for assets (green) and liabilities (red), with net worth as a line. Follow TrendChart.tsx patterns for styling.

- [ ] **Step 2: Create AssetLiabilityForm.tsx**

Modal form for adding/editing assets or liabilities. Two modes controlled by `type: 'asset' | 'liability'` prop. Dynamic fields based on asset_type/liability_type selection. Uses Modal component.

Asset types: Cash, Investment, Retirement, Property, Vehicle, Other
Liability types: Mortgage, Student Loan, Auto Loan, Credit Card, HELOC, Other

Shows relevant fields per type (e.g., ticker/shares for Investment, interest_rate for liabilities).

- [ ] **Step 3: Create NetWorthPage.tsx**

Main page layout:
- Top: three summary cards (Total Assets, Total Liabilities, Net Worth) with month-over-month change
- Middle: NetWorthChart
- Bottom: two columns — Assets list (collapsible by type) and Liabilities list
- "Add Asset" and "Add Liability" buttons open AssetLiabilityForm modal
- "Link to Account" option on cash-type assets

Load data via `api.getNetWorthSummary()`, `api.getAssets()`, `api.getLiabilities()`, `api.getNetWorthHistory(12)`.

- [ ] **Step 4: Commit**

---

## Task 13: Budget Page (Frontend)

**Files:**
- Create: `src/components/Budget/BudgetPage.tsx`
- Create: `src/components/Budget/BudgetProgressBar.tsx`

- [ ] **Step 1: Create BudgetProgressBar.tsx**

Horizontal progress bar component. Props: `categoryName`, `categoryColor`, `spent`, `limit`, `percentage`. Bar turns green (<80%), yellow (80-100%), red (>100%). Shows "$spent / $limit" text and percentage.

- [ ] **Step 2: Create BudgetPage.tsx**

Main page layout:
- Top cards: Total Budgeted, Total Spent, Savings Rate (large prominent %)
- Savings rate trend sparkline (last 6 months)
- Budget list: BudgetProgressBar for each budgeted category
- Unbudgeted categories shown below in muted style
- "Set Budget" inline edit: click on amount to set/change
- "Auto-Suggest" button calls `api.suggestBudgets()` to fill from 3-month averages
- Monthly date navigation (reuse DateRangePicker pattern or simpler month picker)

- [ ] **Step 3: Commit**

---

## Task 14: Goals Page (Frontend)

**Files:**
- Create: `src/components/Goals/GoalsPage.tsx`
- Create: `src/components/Goals/GoalCard.tsx`
- Create: `src/components/Goals/GoalForm.tsx`

- [ ] **Step 1: Create GoalCard.tsx**

Card component showing goal progress. Uses ProgressRing for circular indicator. Shows: name, current/target amounts, percentage, projected completion date, on-track badge (green "On Track" / red "Behind" / blue "Ahead").

- [ ] **Step 2: Create GoalForm.tsx**

Modal form for creating/editing goals. Fields change based on goal_type. Emergency fund auto-fills target from `api.getEmergencyFundTarget()`. Debt payoff links to liabilities. Shows projected completion date dynamically as user types.

- [ ] **Step 3: Create GoalsPage.tsx**

Grid of GoalCards. "Add Goal" button opens GoalForm. Active goals shown first, completed goals in collapsed section below. Summary stats at top: total goals, on-track count, total progress.

- [ ] **Step 4: Commit**

---

## Task 15: Retirement Page (Frontend)

**Files:**
- Create: `src/components/Retirement/RetirementPage.tsx`
- Create: `src/components/Retirement/ProjectionChart.tsx`
- Create: `src/components/Retirement/ScenarioSliders.tsx`

- [ ] **Step 1: Create ScenarioSliders.tsx**

Control panel with sliders for: retirement age (50-80), monthly savings, expected return (1-12%), inflation (1-6%), SS claiming age (62-70), SS monthly benefit. Each slider uses the Slider component. Changes trigger onUpdate callback with new values.

- [ ] **Step 2: Create ProjectionChart.tsx**

Recharts AreaChart showing Monte Carlo fan chart. X-axis: age. Y-axis: portfolio value (formatted as currency). Stacked areas for percentile bands:
- p10-p25: light red area
- p25-p50: light yellow area  
- p50-p75: light green area
- p75-p90: green area
- p50 line: bold median line
- Vertical dashed line at retirement age
- Horizontal line at $0

Takes `data: YearlyProjection[]` and `retirementAge: number`.

- [ ] **Step 3: Create RetirementPage.tsx**

Layout:
- Top: key metric cards — Success Probability (large %), Median Portfolio at Retirement, Monthly Retirement Income, Years Funded
- Middle: two columns — ScenarioSliders (left 1/3) and ProjectionChart (right 2/3)
- Bottom: SS benefit comparison table (62 vs 67 vs 70) and saved scenarios list

First-time setup: if no retirement profile exists, show a setup wizard/form to input current age, income, etc.

Loading states while Monte Carlo runs (it should be fast in Rust but could take a moment with 10k iterations).

- [ ] **Step 4: Commit**

---

## Task 16: Insights Page (Frontend)

**Files:**
- Create: `src/components/Insights/InsightsPage.tsx`
- Create: `src/components/Insights/InsightCard.tsx`

- [ ] **Step 1: Create InsightCard.tsx**

Card component for a single insight. Styled by severity:
- `info`: blue-tinted border/icon
- `positive`: green-tinted (milestones, good trends)
- `warning`: yellow-tinted
- `action_needed`: red-tinted

Shows: icon, title, body text, timestamp, dismiss button. Unread insights have a blue dot indicator.

- [ ] **Step 2: Create InsightsPage.tsx**

Layout:
- "Generate Insights" button at top (calls `api.generateInsights()` then refreshes)
- Filter tabs: All, Spending, Savings, Milestones, Alerts
- Insight feed as a list of InsightCards
- "AI Analysis" section at bottom with a text area showing the structured data from `api.getInsightDataForAi()` and a placeholder for future AI integration (button labeled "Get AI Analysis" — initially shows a message explaining this feature will connect to a local LLM or Claude API)

- [ ] **Step 3: Commit**

---

## Task 17: Forecasting Page (Frontend)

**Files:**
- Create: `src/components/Forecasting/ForecastPage.tsx`

- [ ] **Step 1: Create ForecastPage.tsx**

Layout:
- Top: forecast bar chart (Recharts BarChart) — projected income vs spending for next 6 months, with confidence opacity fade
- Middle: "Upcoming Bills" card — list from `api.getUpcomingBills(30)`, shows merchant, amount, expected date, countdown
- Bottom left: Seasonal spending heat map — 12-month grid showing relative spending intensity
- Bottom right: Debt payoff section (if liabilities exist) — strategy toggle (Avalanche/Snowball), extra payment slider, payoff timeline visualization

- [ ] **Step 2: Commit**

---

## Task 18: Navigation & Routing Updates

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add new nav items to Layout.tsx**

Add to the `navItems` array after the existing items, before Accounts:

```typescript
import {
  // ... existing imports
  Target,
  TrendingUp,
  Flag,
  Sunset,
  Lightbulb,
  CalendarRange,
} from "lucide-react";

// Updated navItems:
const navItems = [
  { to: "/", icon: PieChart, label: "Home" },
  { to: "/transactions", icon: CreditCard, label: "Transactions" },
  { to: "/spending", icon: BarChart3, label: "Spending" },
  { to: "/budget", icon: Target, label: "Budget" },
  { to: "/fixed-costs", icon: CalendarClock, label: "Fixed Costs" },
  { to: "/money-flow", icon: GitBranch, label: "Money Flow" },
  { to: "/net-worth", icon: TrendingUp, label: "Net Worth" },
  { to: "/goals", icon: Flag, label: "Goals" },
  { to: "/retirement", icon: Sunset, label: "Retirement" },
  { to: "/forecast", icon: CalendarRange, label: "Forecast" },
  { to: "/insights", icon: Lightbulb, label: "Insights" },
  { to: "/accounts", icon: Landmark, label: "Accounts" },
];
```

- [ ] **Step 2: Add new routes to App.tsx**

```tsx
import BudgetPage from "./components/Budget/BudgetPage";
import NetWorthPage from "./components/NetWorth/NetWorthPage";
import GoalsPage from "./components/Goals/GoalsPage";
import RetirementPage from "./components/Retirement/RetirementPage";
import ForecastPage from "./components/Forecasting/ForecastPage";
import InsightsPage from "./components/Insights/InsightsPage";

// Add routes:
<Route path="/budget" element={<BudgetPage />} />
<Route path="/net-worth" element={<NetWorthPage />} />
<Route path="/goals" element={<GoalsPage />} />
<Route path="/retirement" element={<RetirementPage />} />
<Route path="/forecast" element={<ForecastPage />} />
<Route path="/insights" element={<InsightsPage />} />
```

- [ ] **Step 3: Add top insights to DashboardPage.tsx**

Add a small "Insights" section at the bottom of the dashboard showing the 3 most recent unread insights as compact cards with a "View All" link to /insights.

- [ ] **Step 4: Verify full build**

Run: `pnpm build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add navigation, routing, and dashboard integration for all wealth planning pages"
```

---

## Task 19: Full Build Verification & Polish

- [ ] **Step 1: Full Rust build**

Run: `cd src-tauri && cargo build`
Fix any compilation errors.

- [ ] **Step 2: Full frontend build**

Run: `pnpm build`
Fix any TypeScript errors.

- [ ] **Step 3: Tauri dev mode test**

Run: `pnpm tauri dev`
Verify the app starts and all pages render without crashes.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete wealth planning platform - net worth, budgets, goals, retirement, forecasting, insights"
```
