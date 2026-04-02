# PerFi Wealth Planning Platform - Design Specification

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Transform PerFi from expense tracker into comprehensive wealth planning platform

---

## 1. Overview

PerFi currently tracks transactions, categorizes spending, and visualizes cash flow. This design extends it into a full wealth planning platform with net worth tracking, budgeting, retirement projections, tax awareness, investment tracking, goal-based planning, cash flow forecasting, and AI-powered behavioral coaching.

### Design Principles
- **Local-first**: All data stays in SQLite. No cloud dependency.
- **AI-ready**: Structured data and prompt-friendly schemas so an AI layer can provide analysis.
- **Progressive complexity**: Simple features work immediately; advanced features (Monte Carlo, tax optimization) build on top.
- **Convention-consistent**: Follow existing Tauri command pattern, React component patterns, Tailwind styling.

---

## 2. Architecture

### 2.1 New Modules (Rust Backend)

```
src-tauri/src/
  commands/
    net_worth.rs        # Net worth snapshots, asset/liability CRUD
    budgets.rs          # Budget targets, tracking, alerts
    goals.rs            # Financial goals CRUD and progress
    retirement.rs       # Retirement projections, Monte Carlo
    tax.rs              # Tax-advantaged account tracking, estimates
    investments.rs      # Holdings, portfolio analysis
    forecasting.rs      # Cash flow projections
    insights.rs         # AI-ready behavioral analysis data
  planning/
    mod.rs
    monte_carlo.rs      # Monte Carlo simulation engine
    projections.rs      # Linear/compound growth projections
    tax_brackets.rs     # Federal/state tax bracket data (2025/2026)
    social_security.rs  # SSA benefit estimation
```

### 2.2 New Pages (React Frontend)

```
src/components/
  NetWorth/
    NetWorthPage.tsx       # Main net worth dashboard
    AssetLiabilityForm.tsx # Add/edit assets & liabilities
    NetWorthChart.tsx      # Net worth over time
  Budget/
    BudgetPage.tsx         # Budget overview with category targets
    BudgetProgressBar.tsx  # Visual budget gauge per category
  Goals/
    GoalsPage.tsx          # Financial goals dashboard
    GoalCard.tsx           # Individual goal progress card
    GoalForm.tsx           # Create/edit goal
  Retirement/
    RetirementPage.tsx     # Retirement planning dashboard
    ProjectionChart.tsx    # Monte Carlo fan chart
    ScenarioSliders.tsx    # What-if parameter controls
  Insights/
    InsightsPage.tsx       # AI-powered behavioral insights
    InsightCard.tsx        # Individual insight display
```

### 2.3 New Routes

```
/net-worth       - Net worth tracking
/budget          - Budget targets and tracking
/goals           - Financial goals
/retirement      - Retirement projections
/insights        - AI behavioral coaching
```

---

## 3. Data Models

### 3.1 Database Migration (004_wealth_planning.sql)

```sql
-- ══════════════════════════════════════════════
-- ASSETS & LIABILITIES (Net Worth)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS assets (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    asset_type      TEXT NOT NULL,  -- 'cash','investment','retirement','property','vehicle','other'
    institution     TEXT,
    current_value_cents INTEGER NOT NULL DEFAULT 0,
    -- For investment/retirement accounts
    ticker          TEXT,           -- e.g. 'VTSAX', 'SPY'
    shares          REAL,
    cost_basis_cents INTEGER,
    -- For property
    purchase_price_cents INTEGER,
    purchase_date   TEXT,
    -- Tax-advantaged tracking
    tax_treatment   TEXT,           -- 'taxable','traditional','roth','hsa','529'
    contribution_ytd_cents INTEGER DEFAULT 0,
    contribution_limit_cents INTEGER, -- annual limit for this account type
    -- Metadata
    notes           TEXT,
    is_manual       INTEGER DEFAULT 1,
    linked_account_id TEXT REFERENCES accounts(id),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS liabilities (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    liability_type  TEXT NOT NULL,  -- 'mortgage','student_loan','auto_loan','credit_card','heloc','other'
    institution     TEXT,
    current_balance_cents INTEGER NOT NULL DEFAULT 0,
    original_balance_cents INTEGER,
    interest_rate   REAL,          -- APR as decimal, e.g. 0.065 for 6.5%
    minimum_payment_cents INTEGER,
    monthly_payment_cents INTEGER,
    payment_day     INTEGER,       -- day of month
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
    breakdown_json  TEXT,  -- JSON of {asset_type: cents, ...} for drill-down
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
    name            TEXT NOT NULL,  -- 'Overall Savings Rate', 'Emergency Fund Monthly'
    target_type     TEXT NOT NULL,  -- 'rate' (percentage) or 'amount' (fixed cents)
    target_value    REAL NOT NULL,  -- 0.20 for 20% rate, or cents for amount
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ══════════════════════════════════════════════
-- FINANCIAL GOALS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS goals (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    goal_type       TEXT NOT NULL,  -- 'emergency_fund','house_down_payment','debt_payoff',
                                   -- 'retirement','college_529','custom'
    target_cents    INTEGER NOT NULL,
    current_cents   INTEGER NOT NULL DEFAULT 0,
    monthly_contribution_cents INTEGER DEFAULT 0,
    target_date     TEXT,
    priority        INTEGER DEFAULT 0,
    linked_asset_id TEXT REFERENCES assets(id),
    icon            TEXT,
    color           TEXT,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'active',  -- 'active','completed','paused'
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
    -- Income
    annual_income_cents   INTEGER,
    income_growth_rate    REAL DEFAULT 0.03,     -- 3% annual raises
    -- Social Security
    ss_monthly_benefit_cents INTEGER,            -- estimated at FRA
    ss_claiming_age       INTEGER DEFAULT 67,    -- full retirement age
    -- Spending
    retirement_spending_rate REAL DEFAULT 0.80,  -- 80% of pre-retirement spending
    -- Assumptions (user-adjustable)
    inflation_rate        REAL DEFAULT 0.03,
    pre_retirement_return REAL DEFAULT 0.07,     -- nominal
    post_retirement_return REAL DEFAULT 0.05,
    withdrawal_rate       REAL DEFAULT 0.04,     -- safe withdrawal rate
    -- Tax
    effective_tax_rate    REAL DEFAULT 0.22,
    state                 TEXT,
    filing_status         TEXT DEFAULT 'single', -- 'single','married_joint','married_separate','head_of_household'
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS retirement_scenarios (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    description           TEXT,
    -- Override any retirement_profile field
    overrides_json        TEXT NOT NULL,  -- JSON of field overrides
    result_json           TEXT,           -- cached simulation results
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ══════════════════════════════════════════════
-- TAX TRACKING
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tax_events (
    id              TEXT PRIMARY KEY,
    tax_year        INTEGER NOT NULL,
    event_type      TEXT NOT NULL,  -- 'contribution','withdrawal','capital_gain','capital_loss',
                                   -- 'dividend','interest','charitable','deductible_expense'
    amount_cents    INTEGER NOT NULL,
    description     TEXT,
    asset_id        TEXT REFERENCES assets(id),
    is_short_term   INTEGER,        -- for capital gains
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tax_events_year ON tax_events(tax_year);

-- ══════════════════════════════════════════════
-- AI INSIGHTS CACHE
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS insights (
    id              TEXT PRIMARY KEY,
    insight_type    TEXT NOT NULL,  -- 'spending_alert','savings_trend','lifestyle_inflation',
                                   -- 'milestone','optimization','anomaly'
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    severity        TEXT DEFAULT 'info',  -- 'info','positive','warning','action_needed'
    data_json       TEXT,           -- supporting data for the insight
    is_read         INTEGER DEFAULT 0,
    is_dismissed    INTEGER DEFAULT 0,
    expires_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);
```

---

## 4. Feature Specifications

### 4.1 Net Worth Tracking

**Purpose:** Single view of total financial picture — assets minus liabilities over time.

**Backend Commands:**
- `get_assets()` -> Vec<Asset>
- `create_asset(...)` -> Asset
- `update_asset(id, ...)` -> ()
- `delete_asset(id)` -> ()
- `get_liabilities()` -> Vec<Liability>
- `create_liability(...)` -> Liability
- `update_liability(id, ...)` -> ()
- `delete_liability(id)` -> ()
- `get_net_worth_summary()` -> NetWorthSummary { total_assets, total_liabilities, net_worth, by_type }
- `get_net_worth_history(months)` -> Vec<NetWorthSnapshot>
- `take_net_worth_snapshot()` -> () — auto-called monthly or on demand
- `link_asset_to_account(asset_id, account_id)` -> () — auto-sync balance from transactions

**UI:**
- Top cards: Total Assets, Total Liabilities, Net Worth (with month-over-month change)
- Line chart: net worth over time with assets/liabilities stacked area
- Collapsible sections by asset type (Cash, Investments, Retirement, Property, Vehicles)
- Liability section with interest rates and payoff projections
- "Link to Account" button to auto-sync cash account balances

**Auto-sync logic:** When an asset is linked to a bank account, its `current_value_cents` auto-updates from the computed account balance (sum of transactions). This bridges existing transaction data with net worth tracking.

---

### 4.2 Budget Goals & Savings Rate

**Purpose:** Set spending targets by category, track savings rate.

**Backend Commands:**
- `get_budgets()` -> Vec<BudgetWithSpending> (includes current month actual)
- `set_budget(category_id, monthly_limit_cents)` -> Budget
- `delete_budget(id)` -> ()
- `get_budget_status(month)` -> BudgetStatus { budgets, total_budgeted, total_spent, savings_rate }
- `get_savings_rate(months)` -> Vec<SavingsRatePoint> { month, income, spending, rate }

**UI:**
- Category budget bars: horizontal progress bars colored green/yellow/red based on % spent
- Overall monthly budget summary
- Savings rate trend line (big prominent metric)
- "Quick Budget" — auto-suggest budgets based on 3-month average spending per category
- Alert badges on categories exceeding 80% or 100% of budget

**Savings Rate Calculation:**
```
savings_rate = (income - spending) / income
```
Where income and spending come from existing cash flow logic.

---

### 4.3 Retirement Projections

**Purpose:** Answer "Can I retire?" with Monte Carlo simulation.

**Backend Commands:**
- `get_retirement_profile()` -> RetirementProfile
- `save_retirement_profile(...)` -> ()
- `run_retirement_projection(overrides?)` -> RetirementProjection
- `run_monte_carlo(iterations, overrides?)` -> MonteCarloResult
- `get_required_savings_rate(target_age)` -> f64
- `get_retirement_scenarios()` -> Vec<Scenario>
- `save_retirement_scenario(name, overrides)` -> Scenario

**Monte Carlo Engine (Rust):**
- Default 1,000 iterations (configurable)
- Uses log-normal return distribution with historical mean/stddev
- Accounts for: inflation, income growth, SS benefits, tax drag
- Returns percentile bands: 10th, 25th, 50th, 75th, 90th
- Sequence-of-returns risk modeled by drawing yearly returns randomly

**Key Outputs:**
- Probability of success (not running out of money)
- Projected portfolio value at retirement
- Sustainable monthly income in retirement
- Years until money runs out at each percentile

**UI:**
- Fan chart: percentile bands over time (classic Monte Carlo visualization)
- Input panel with sliders: retirement age, monthly savings, expected return, SS benefit
- Key metrics cards: Success %, Years funded, Monthly income
- "What-if" scenarios saved and compared side by side
- Required savings calculator: "To retire at X, save $Y/month"

---

### 4.4 Tax Awareness

**Purpose:** Track tax-advantaged accounts, estimate tax impact, spot optimization opportunities.

**Backend Commands:**
- `get_tax_summary(year)` -> TaxSummary { income, deductions, estimated_tax, effective_rate, bracket }
- `get_contribution_status()` -> Vec<ContributionStatus> { account, ytd, limit, remaining }
- `track_tax_event(...)` -> TaxEvent
- `get_tax_events(year)` -> Vec<TaxEvent>

**Tax Bracket Data (hardcoded, updatable):**
- 2025/2026 federal brackets for all filing statuses
- Standard deduction amounts
- Contribution limits: 401k ($23,500), IRA ($7,000), HSA ($4,300), 529 (state-dependent)

**AI Integration Point:** Tax optimization suggestions are ideal for AI analysis:
- "You have $X in traditional IRA and are in the 12% bracket — consider Roth conversion"
- "You're $2,000 below your 401k max — contributing more saves ~$440 in taxes"
- "You have unrealized losses that could offset $X in gains"

**UI:**
- Contribution tracker cards (401k, IRA, HSA) with progress rings
- Estimated tax bracket indicator
- Tax events timeline for the year
- AI-generated optimization suggestions (marked as AI-generated)

---

### 4.5 Investment Portfolio (Manual Entry + Optional Market Data)

**Purpose:** Track holdings, asset allocation, basic portfolio analysis.

**Approach:** Manual entry of holdings with optional market price lookup. No brokerage API integration initially — complexity vs. value tradeoff. Users enter ticker + shares; the app can optionally fetch prices.

**Backend Commands:**
- `get_portfolio_summary()` -> PortfolioSummary { total_value, allocation, gain_loss }
- `get_holdings()` -> Vec<Holding> — aggregated from assets where asset_type = 'investment' or 'retirement'
- Holdings data comes from the `assets` table (ticker, shares, cost_basis fields)

**UI:**
- Donut chart: asset allocation (stocks/bonds/real estate/cash)
- Holdings table: name, ticker, shares, cost basis, current value, gain/loss
- Rebalancing indicator if allocation drifts >5% from target

**Note:** This is intentionally simpler than a dedicated investment platform. The value is seeing investments alongside spending and net worth in one place.

---

### 4.6 Financial Goals

**Purpose:** Track progress toward specific financial targets.

**Backend Commands:**
- `get_goals()` -> Vec<GoalWithProgress>
- `create_goal(...)` -> Goal
- `update_goal(id, ...)` -> ()
- `delete_goal(id)` -> ()
- `get_goal_projections(id)` -> GoalProjection { on_track, months_to_target, projected_date }

**Goal Types with Smart Defaults:**
- Emergency Fund: target = 6 * monthly_spending (auto-calculated from spending data)
- House Down Payment: user sets target, tracks progress
- Debt Payoff: linked to liability, tracks balance reduction
- Retirement: linked to retirement projection
- Financial Independence: target = 25 * annual_spending
- Custom: fully user-defined

**UI:**
- Goal cards with circular progress indicators
- Projected completion date based on current contribution rate
- "On Track" / "Behind" / "Ahead" status badges
- Color-coded by priority

---

### 4.7 Cash Flow Forecasting

**Purpose:** Project future cash flow based on historical patterns.

**Backend Commands:**
- `get_cash_flow_forecast(months)` -> Vec<ForecastPoint> { month, projected_income, projected_spending, projected_net, confidence }
- `get_upcoming_bills(days)` -> Vec<UpcomingBill> { merchant, expected_amount, expected_date, confidence }
- `get_seasonal_patterns()` -> Vec<SeasonalPattern> { month, avg_spending, category_breakdown }
- `get_irregular_expenses()` -> Vec<IrregularExpense> { description, annual_total, occurrences, avg_amount }

**Forecasting Logic:**
- Uses existing fixed costs detection + historical averages
- Income: average of last 3 months (or detected recurring income)
- Fixed expenses: from fixed costs analysis
- Variable expenses: category averages with seasonal adjustment
- Confidence decreases for months further out

**AI Integration Point:** AI can analyze patterns humans miss:
- "Your spending historically spikes 40% in November-December"
- "Car maintenance averages $2,400/year but clusters in Q2"
- "Your income has grown 8% YoY — factoring this into projections"

**UI:**
- Bar chart: projected income vs. spending for next 6-12 months
- Upcoming bills list with countdown
- Seasonal spending heat map
- Irregular expense annualization table

---

### 4.8 AI-Powered Behavioral Insights

**Purpose:** The "accountability partner" — detect patterns, celebrate milestones, flag concerns.

**This is where AI adds the most value.** Rather than hardcoding rules, the insights engine prepares structured financial data and presents it to the user with AI-generated analysis.

**Backend Commands (data preparation):**
- `get_insight_data()` -> InsightData — comprehensive financial snapshot for AI analysis
- `get_spending_anomalies(months)` -> Vec<Anomaly> — transactions or categories that deviate significantly
- `get_milestone_checks()` -> Vec<MilestoneCheck> — check if any milestones were hit
- `save_insight(...)` -> Insight
- `get_insights(unread_only?)` -> Vec<Insight>
- `dismiss_insight(id)` -> ()

**Insight Categories:**

| Type | Example | Trigger |
|------|---------|---------|
| `spending_alert` | "Dining spending up 35% over 3 months" | Category trend exceeds 20% growth |
| `savings_trend` | "Savings rate dropped from 22% to 14%" | Savings rate change > 5 points |
| `lifestyle_inflation` | "Income grew 15% but spending grew 22%" | Spending growth > income growth |
| `milestone` | "You hit $100k net worth!" | Net worth crosses round thresholds |
| `optimization` | "Switching to index funds could save $180k over 30 years" | Fee analysis on holdings |
| `anomaly` | "Unusual $3,200 charge at BEST BUY" | Transaction > 3x category average |
| `forecast` | "At current rate, emergency fund is fully funded by August" | Goal projection update |
| `tax_opportunity` | "Low income month — good Roth conversion window" | Income dip detected |

**AI Integration Architecture:**
The insights engine generates structured data snapshots. The UI includes an "AI Analysis" section where:
1. Backend prepares a JSON summary of relevant financial data
2. Frontend displays the data with a "Get AI Analysis" button
3. When clicked, data is sent to a local LLM or Claude API for natural language analysis
4. Response is cached as an insight in the database

**This keeps AI optional and privacy-respecting** — data never leaves the machine unless the user explicitly requests AI analysis.

**UI:**
- Insights feed on the dashboard (top 3 unread insights)
- Dedicated Insights page with full history
- Insight cards with severity-based styling (green/blue/yellow/red)
- Dismiss and mark-as-read functionality
- "Get AI Analysis" button for on-demand deeper analysis

---

### 4.9 Social Security Estimation (Within Retirement Module)

**Purpose:** Model SS claiming age impact on retirement projections.

**Integrated into retirement projections, not a separate module.**

**Logic:**
- User enters estimated monthly benefit at Full Retirement Age (FRA)
- System applies SS adjustment factors:
  - Age 62: ~70% of FRA benefit
  - Age 67 (FRA): 100%
  - Age 70: ~124% of FRA benefit (8% per year delayed credits)
- Break-even analysis: "Claiming at 70 vs 62 breaks even at age 80"
- Spousal benefits: simplified model (50% of higher earner's FRA benefit)

**UI:**
- Slider within retirement page for SS claiming age
- Comparison table: monthly benefit at 62/67/70
- Break-even chart
- Impact on overall retirement projection shown in real-time

---

### 4.10 Debt Payoff Strategies (Within Goals Module)

**Purpose:** Model debt payoff with avalanche vs. snowball strategies.

**Backend Commands:**
- `calculate_debt_payoff(strategy, extra_payment?)` -> DebtPayoffPlan
- Strategy: 'avalanche' (highest interest first) or 'snowball' (lowest balance first)

**Logic:**
- Takes all liabilities with balances, rates, and minimum payments
- Simulates month-by-month payoff with optional extra payment amount
- Compares total interest paid between strategies
- Projects payoff date for each debt

**UI:**
- Within Goals page as a "Debt Freedom" goal type
- Timeline visualization showing when each debt is paid off
- Total interest comparison between strategies
- "What if I add $X/month?" slider

---

## 5. Navigation Update

Updated nav rail:
```
Home (Dashboard)        - PieChart icon
Transactions            - CreditCard icon
Spending                - BarChart3 icon
Budget                  - Target icon (NEW)
Fixed Costs             - CalendarClock icon
Money Flow              - GitBranch icon
Net Worth               - TrendingUp icon (NEW)
Goals                   - Flag icon (NEW)
Retirement              - Sunset icon (NEW)
Insights                - Lightbulb icon (NEW)
Accounts                - Landmark icon
---
Theme toggle
Settings
```

---

## 6. Implementation Priority

| Phase | Features | Rationale |
|-------|----------|-----------|
| 1 | Database migration, Net Worth, Budget | Foundation — everything else builds on this |
| 2 | Goals, Cash Flow Forecasting | Extends existing data with forward-looking planning |
| 3 | Retirement Projections (Monte Carlo) | Core wealth planning feature |
| 4 | Tax Awareness, Investment Portfolio | Advanced planning features |
| 5 | AI Insights Engine | Capstone — requires all other data to be meaningful |

---

## 7. Technical Decisions

- **Amounts in cents (INTEGER):** Continues existing pattern. All new monetary values stored as cents.
- **Monte Carlo in Rust:** CPU-intensive simulation runs natively, not in JS. Rust's performance makes 10,000 iterations trivial.
- **No external API dependencies for core features:** Market prices are nice-to-have, not required. Manual entry is the baseline.
- **AI is optional:** The insights engine works without AI (rule-based anomaly detection). AI enhances the analysis but isn't required.
- **Snapshots for historical data:** Net worth snapshots capture point-in-time values. This avoids reconstructing history from mutable asset values.
- **Tax data is informational, not tax advice:** Clear disclaimers. We estimate, not advise.

---

## 8. Out of Scope (For Now)

- Brokerage API integration (Plaid Investments, etc.)
- Real-time market data feeds
- Insurance needs calculator
- Estate planning
- Crypto wallet tracking
- Multi-user / family accounts
- PDF report generation
