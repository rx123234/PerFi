use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub institution: Option<String>,
    pub account_type: String,
    pub teller_account_id: Option<String>,
    pub teller_enrollment_id: Option<String>,
    pub mask: Option<String>,
    pub source: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub exclude_from_planning: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub account_id: String,
    pub date: String,
    pub amount: f64,
    pub description: String,
    pub enriched_desc: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub merchant: Option<String>,
    pub source: String,
    pub pending: bool,
    pub exclude_from_planning: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryRule {
    pub id: String,
    pub pattern: String,
    pub category_id: String,
    pub category_name: Option<String>,
    pub priority: i32,
}

/// Internal-only: full Teller config for API calls (never sent to frontend)
#[derive(Debug, Clone)]
pub struct TellerConfig {
    pub app_id: String,
    pub environment: String,
    pub cert_path: String,
    pub key_path: String,
}

/// Safe to send to frontend — no cert paths, app_id is public
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TellerConfigMeta {
    pub is_configured: bool,
    pub environment: String,
    pub app_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashFlowSummary {
    pub income: f64,
    pub spending: f64,
    pub net: f64,
    pub prev_income: f64,
    pub prev_spending: f64,
    pub prev_net: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySpending {
    pub category_id: String,
    pub category_name: String,
    pub color: String,
    pub amount: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendDataPoint {
    pub period: String,
    pub income: f64,
    pub spending: f64,
    pub categories: Vec<CategoryAmount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryAmount {
    pub category_name: String,
    pub color: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyNode {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyLink {
    pub source: usize,
    pub target: usize,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyData {
    pub nodes: Vec<SankeyNode>,
    pub links: Vec<SankeyLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerchantSpending {
    pub merchant: String,
    pub amount: f64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountBalance {
    pub account_id: String,
    pub account_name: String,
    pub account_type: String,
    pub institution: Option<String>,
    pub balance: f64,
    pub mask: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: usize,
    pub duplicates: usize,
    pub categorized: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpendingCategory {
    pub name: String,
    pub color: String,
    pub amounts: Vec<f64>,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpendingBreakdown {
    pub months: Vec<String>,
    pub categories: Vec<SpendingCategory>,
    pub monthly_totals: Vec<f64>,
    pub grand_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixedCostItem {
    pub merchant: String,
    pub category: String,
    pub color: String,
    pub amounts: Vec<Option<f64>>,
    pub avg_amount: f64,
    pub frequency: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixedCostsAnalysis {
    pub months: Vec<String>,
    pub items: Vec<FixedCostItem>,
    pub monthly_totals: Vec<f64>,
    pub total_monthly_avg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionFilter {
    pub account_id: Option<String>,
    pub category_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub profile: String,
    pub is_default_profile: bool,
    pub app_data_dir: String,
    pub db_path: String,
}

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
pub struct RetirementProfileState {
    pub profile: RetirementProfile,
    pub has_saved_profile: bool,
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
    pub net_p10: f64,
    pub net_p90: f64,
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
