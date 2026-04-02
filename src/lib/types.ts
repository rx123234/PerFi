export interface Account {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  teller_account_id: string | null;
  teller_enrollment_id: string | null;
  mask: string | null;
  source: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  exclude_from_planning: boolean;
}

export interface Transaction {
  id: string;
  account_id: string;
  date: string;
  amount: number;
  description: string;
  enriched_desc: string | null;
  category_id: string | null;
  category_name: string | null;
  merchant: string | null;
  source: string;
  pending: boolean;
  exclude_from_planning: boolean;
  created_at: string;
}

export interface CategoryRule {
  id: string;
  pattern: string;
  category_id: string;
  category_name: string | null;
  priority: number;
}

export interface TellerConfigMeta {
  is_configured: boolean;
  environment: string;
  app_id: string;
}

export interface CashFlowSummary {
  income: number;
  spending: number;
  net: number;
  prev_income: number;
  prev_spending: number;
  prev_net: number;
}

export interface CategorySpending {
  category_id: string;
  category_name: string;
  color: string;
  amount: number;
  percentage: number;
}

export interface TrendDataPoint {
  period: string;
  income: number;
  spending: number;
  categories: CategoryAmount[];
}

export interface CategoryAmount {
  category_name: string;
  color: string;
  amount: number;
}

export interface SankeyData {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
}

export interface MerchantSpending {
  merchant: string;
  amount: number;
  count: number;
}

export interface AccountBalance {
  account_id: string;
  account_name: string;
  account_type: string;
  institution: string | null;
  balance: number;
  mask: string | null;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  categorized: number;
  errors: string[];
}

export interface TransactionFilter {
  account_id: string | null;
  category_id: string | null;
  start_date: string | null;
  end_date: string | null;
  search: string | null;
  limit: number | null;
  offset: number | null;
}

export interface CsvFormat {
  name: string;
  date_column: string;
  date_format: string;
  description_column: string;
  amount_column: string | null;
  debit_column: string | null;
  credit_column: string | null;
  amount_inverted: boolean;
}

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

export interface SpendingBreakdown {
  months: string[];
  categories: SpendingCategoryData[];
  monthly_totals: number[];
  grand_total: number;
}

export interface SpendingCategoryData {
  name: string;
  color: string;
  amounts: number[];
  total: number;
}

export interface FixedCostItem {
  merchant: string;
  category: string;
  color: string;
  amounts: (number | null)[];
  avg_amount: number;
  frequency: number;
}

export interface FixedCostsAnalysis {
  months: string[];
  items: FixedCostItem[];
  monthly_totals: number[];
  total_monthly_avg: number;
}

// ═══════════════════════════════════════════
// Net Worth
// ═══════════════════════════════════════════

export interface Asset {
  id: string;
  name: string;
  asset_type: string;
  institution: string | null;
  current_value_cents: number;
  ticker: string | null;
  shares: number | null;
  cost_basis_cents: number | null;
  purchase_price_cents: number | null;
  purchase_date: string | null;
  tax_treatment: string | null;
  contribution_ytd_cents: number;
  contribution_limit_cents: number | null;
  notes: string | null;
  is_manual: boolean;
  linked_account_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface Liability {
  id: string;
  name: string;
  liability_type: string;
  institution: string | null;
  current_balance_cents: number;
  original_balance_cents: number | null;
  interest_rate: number | null;
  minimum_payment_cents: number | null;
  monthly_payment_cents: number | null;
  payment_day: number | null;
  maturity_date: string | null;
  linked_account_id: string | null;
  notes: string | null;
  updated_at: string;
  created_at: string;
}

export interface NetWorthSnapshot {
  id: string;
  snapshot_date: string;
  total_assets_cents: number;
  total_liabilities_cents: number;
  net_worth_cents: number;
  breakdown_json: string | null;
  created_at: string;
}

export interface AssetTypeTotal {
  asset_type: string;
  total: number;
  count: number;
}

export interface LiabilityTypeTotal {
  liability_type: string;
  total: number;
  count: number;
}

export interface NetWorthSummary {
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  prev_net_worth: number | null;
  assets_by_type: AssetTypeTotal[];
  liabilities_by_type: LiabilityTypeTotal[];
}

// ═══════════════════════════════════════════
// Budgets
// ═══════════════════════════════════════════

export interface Budget {
  id: string;
  category_id: string;
  category_name: string | null;
  category_color: string | null;
  monthly_limit_cents: number;
  is_active: boolean;
  created_at: string;
}

export interface BudgetWithSpending {
  budget: Budget;
  spent_cents: number;
  remaining_cents: number;
  percentage: number;
}

export interface BudgetStatus {
  budgets: BudgetWithSpending[];
  total_budgeted: number;
  total_spent: number;
  unbudgeted_spending: number;
  savings_rate: number;
  income: number;
}

export interface SavingsRatePoint {
  month: string;
  income: number;
  spending: number;
  savings_rate: number;
}

// ═══════════════════════════════════════════
// Goals
// ═══════════════════════════════════════════

export interface Goal {
  id: string;
  name: string;
  goal_type: string;
  target_cents: number;
  current_cents: number;
  monthly_contribution_cents: number;
  target_date: string | null;
  priority: number;
  linked_asset_id: string | null;
  icon: string | null;
  color: string | null;
  notes: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export interface GoalWithProgress {
  goal: Goal;
  percentage: number;
  projected_completion_date: string | null;
  on_track: boolean;
  months_remaining: number | null;
}

// ═══════════════════════════════════════════
// Retirement
// ═══════════════════════════════════════════

export interface RetirementProfile {
  current_age: number;
  retirement_age: number;
  life_expectancy: number;
  annual_income_cents: number | null;
  income_growth_rate: number;
  ss_monthly_benefit_cents: number | null;
  ss_claiming_age: number;
  retirement_spending_rate: number;
  inflation_rate: number;
  pre_retirement_return: number;
  post_retirement_return: number;
  withdrawal_rate: number;
  effective_tax_rate: number;
  state: string | null;
  filing_status: string;
}

export interface RetirementProfileState {
  profile: RetirementProfile;
  has_saved_profile: boolean;
}

export interface ProjectionPercentile {
  percentile: number;
  portfolio_at_retirement: number;
  years_funded: number;
  monthly_income: number;
}

export interface YearlyProjection {
  age: number;
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface RetirementProjection {
  success_probability: number;
  median_portfolio_at_retirement: number;
  monthly_retirement_income: number;
  years_funded_median: number;
  required_monthly_savings: number;
  percentiles: ProjectionPercentile[];
  yearly_data: YearlyProjection[];
}

export interface RetirementScenario {
  id: string;
  name: string;
  description: string | null;
  overrides_json: string;
  result_json: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════
// Tax
// ═══════════════════════════════════════════

export interface ContributionStatus {
  asset_id: string;
  asset_name: string;
  tax_treatment: string;
  contribution_ytd: number;
  contribution_limit: number;
  remaining: number;
  percentage: number;
}

export interface TaxSummary {
  tax_year: number;
  estimated_income: number;
  estimated_deductions: number;
  taxable_income: number;
  estimated_federal_tax: number;
  effective_rate: number;
  marginal_bracket: string;
  filing_status: string;
  contributions: ContributionStatus[];
}

// ═══════════════════════════════════════════
// Insights
// ═══════════════════════════════════════════

export interface SpendingTrend {
  category_name: string;
  current_month: number;
  three_month_avg: number;
  change_pct: number;
}

export interface SpendingAnomaly {
  transaction_id: string;
  description: string;
  amount: number;
  category_name: string;
  category_avg: number;
  deviation_factor: number;
}

export interface MilestoneCheck {
  milestone_type: string;
  description: string;
  achieved: boolean;
  value: number;
}

export interface Insight {
  id: string;
  insight_type: string;
  title: string;
  body: string;
  severity: string;
  data_json: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  expires_at: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════
// Forecasting
// ═══════════════════════════════════════════

export interface ForecastPoint {
  month: string;
  projected_income: number;
  projected_spending: number;
  projected_net: number;
  net_p10: number;
  net_p90: number;
  confidence: number;
}

export interface UpcomingBill {
  merchant: string;
  expected_amount: number;
  expected_date: string;
  category: string;
  confidence: number;
}

export interface SeasonalPattern {
  month: number;
  month_name: string;
  avg_spending: number;
  vs_annual_avg: number;
}

export interface DebtPayment {
  month: string;
  payment: number;
  principal: number;
  interest: number;
  remaining: number;
}

export interface DebtPayoffItem {
  liability_id: string;
  name: string;
  current_balance: number;
  interest_rate: number;
  payoff_date: string;
  total_interest: number;
  monthly_payments: DebtPayment[];
}

export interface DebtPayoffPlan {
  strategy: string;
  total_interest: number;
  payoff_date: string;
  monthly_payment: number;
  debts: DebtPayoffItem[];
}

// ═══════════════════════════════════════════
// Investment Import
// ═══════════════════════════════════════════

export interface ImportedHolding {
  account_name: string;
  account_number: string;
  account_type: string;
  symbol: string;
  description: string;
  quantity: number;
  price: number;
  ending_value_cents: number;
  cost_basis_cents: number | null;
}

export interface InvestmentImportResult {
  holdings: ImportedHolding[];
  created: number;
  updated: number;
  skipped: number;
}
