import { invoke } from "@tauri-apps/api/core";
import type {
  Account,
  AccountBalance,
  Asset,
  Budget,
  BudgetStatus,
  BudgetWithSpending,
  CashFlowSummary,
  Category,
  CategoryRule,
  CategorySpending,
  CsvFormat,
  DebtPayoffPlan,
  FixedCostsAnalysis,
  ForecastPoint,
  Goal,
  GoalWithProgress,
  ImportResult,
  Insight,
  Liability,
  MerchantSpending,
  NetWorthSnapshot,
  NetWorthSummary,
  RetirementProfile,
  RetirementProfileState,
  RetirementProjection,
  RetirementScenario,
  SankeyData,
  SavingsRatePoint,
  SeasonalPattern,
  SpendingBreakdown,
  SyncResult,
  Transaction,
  TransactionFilter,
  TellerConfigMeta,
  TrendDataPoint,
  UpcomingBill,
  ImportedHolding,
  InvestmentImportResult,
} from "./types";

// Accounts
export const getAccounts = () => invoke<Account[]>("get_accounts");
export const createAccount = (name: string, institution: string | null, accountType: string) =>
  invoke<Account>("create_account", { name, institution, accountType });
export const updateAccount = (id: string, name: string, institution: string | null, accountType: string) =>
  invoke<void>("update_account", { id, name, institution, accountType });
export const deleteAccount = (id: string) => invoke<void>("delete_account", { id });

// Transactions
export const getTransactions = (filter: TransactionFilter) =>
  invoke<Transaction[]>("get_transactions", { filter });
export const updateTransactionCategory = (transactionId: string, categoryId: string | null) =>
  invoke<void>("update_transaction_category", { transactionId, categoryId });
export const getTransactionCount = (filter: TransactionFilter) =>
  invoke<number>("get_transaction_count", { filter });

// Categories
export const getCategories = () => invoke<Category[]>("get_categories");
export const createCategory = (name: string, color: string | null, parentId: string | null) =>
  invoke<Category>("create_category", { name, color, parentId });
export const updateCategory = (id: string, name: string, color: string | null) =>
  invoke<void>("update_category", { id, name, color });
export const deleteCategory = (id: string) => invoke<void>("delete_category", { id });

// Category Rules
export const getCategoryRules = () => invoke<CategoryRule[]>("get_category_rules");
export const createCategoryRule = (pattern: string, categoryId: string, priority: number) =>
  invoke<CategoryRule>("create_category_rule", { pattern, categoryId, priority });
export const deleteCategoryRule = (id: string) => invoke<void>("delete_category_rule", { id });

// Dashboard
export const getCashFlowSummary = (
  startDate: string, endDate: string, prevStartDate: string, prevEndDate: string, accountId?: string
) =>
  invoke<CashFlowSummary>("get_cash_flow_summary", {
    startDate, endDate, prevStartDate, prevEndDate, accountId: accountId ?? null,
  });

export const getSpendingByCategory = (startDate: string, endDate: string, accountId?: string) =>
  invoke<CategorySpending[]>("get_spending_by_category", {
    startDate, endDate, accountId: accountId ?? null,
  });

export const getSpendingTrends = (
  startDate: string, endDate: string, granularity: string, accountId?: string
) =>
  invoke<TrendDataPoint[]>("get_spending_trends", {
    startDate, endDate, granularity, accountId: accountId ?? null,
  });

export const getSankeyData = (startDate: string, endDate: string, accountId?: string) =>
  invoke<SankeyData>("get_sankey_data", {
    startDate, endDate, accountId: accountId ?? null,
  });

export const getTopMerchants = (startDate: string, endDate: string, limit?: number, accountId?: string) =>
  invoke<MerchantSpending[]>("get_top_merchants", {
    startDate, endDate, limit: limit ?? null, accountId: accountId ?? null,
  });

export const getAccountBalances = () => invoke<AccountBalance[]>("get_account_balances");

// Teller
export const saveTellerConfig = (appId: string, environment: string, certPath: string, keyPath: string) =>
  invoke<void>("save_teller_config", { appId, environment, certPath, keyPath });
export const getTellerConfig = () => invoke<TellerConfigMeta>("get_teller_config");
export const tellerConnectSuccess = (accessToken: string, enrollmentId: string) =>
  invoke<Account[]>("teller_connect_success", { accessToken, enrollmentId });
export const syncTransactions = (accountId: string) =>
  invoke<SyncResult>("sync_transactions", { accountId });
export const syncAllAccounts = () =>
  invoke<[string, SyncResult][]>("sync_all_accounts");
export const syncBalancesOnly = () => invoke<number>("sync_balances_only");

// Import
export const getCsvFormats = () => invoke<CsvFormat[]>("get_csv_formats");
export const previewCsv = (filePath: string, formatName: string, accountId: string) =>
  invoke<Record<string, unknown>[]>("preview_csv", { filePath, formatName, accountId });
export const importCsv = (filePath: string, accountId: string, formatName: string) =>
  invoke<ImportResult>("import_csv", { filePath, accountId, formatName });
export const recategorizeTransactions = () => invoke<number>("recategorize_transactions");

// Spending Breakdown
export const getSpendingBreakdown = (trailingMonths: number) =>
  invoke<SpendingBreakdown>("get_spending_breakdown", { trailingMonths });

// Fixed Costs
export const getFixedCosts = (trailingMonths: number, minMonths?: number) =>
  invoke<FixedCostsAnalysis>("get_fixed_costs", { trailingMonths, minMonths: minMonths ?? null });

// Net Worth
export const getAssets = () => invoke<Asset[]>("get_assets");
export const createAsset = (name: string, assetType: string, institution: string | null, currentValueCents: number, ticker: string | null, shares: number | null, costBasisCents: number | null, purchasePriceCents: number | null, purchaseDate: string | null, taxTreatment: string | null, contributionYtdCents: number, contributionLimitCents: number | null, notes: string | null, linkedAccountId: string | null) =>
  invoke<Asset>("create_asset", { name, assetType, institution, currentValueCents, ticker, shares, costBasisCents, purchasePriceCents, purchaseDate, taxTreatment, contributionYtdCents, contributionLimitCents, notes, linkedAccountId });
export const updateAsset = (id: string, name: string, assetType: string, institution: string | null, currentValueCents: number, ticker: string | null, shares: number | null, costBasisCents: number | null, purchasePriceCents: number | null, purchaseDate: string | null, taxTreatment: string | null, contributionYtdCents: number, contributionLimitCents: number | null, notes: string | null, linkedAccountId: string | null) =>
  invoke<void>("update_asset", { id, name, assetType, institution, currentValueCents, ticker, shares, costBasisCents, purchasePriceCents, purchaseDate, taxTreatment, contributionYtdCents, contributionLimitCents, notes, linkedAccountId });
export const deleteAsset = (id: string) => invoke<void>("delete_asset", { id });

export const getLiabilities = () => invoke<Liability[]>("get_liabilities");
export const createLiability = (name: string, liabilityType: string, institution: string | null, currentBalanceCents: number, originalBalanceCents: number | null, interestRate: number | null, minimumPaymentCents: number | null, monthlyPaymentCents: number | null, paymentDay: number | null, maturityDate: string | null, linkedAccountId: string | null, notes: string | null) =>
  invoke<Liability>("create_liability", { name, liabilityType, institution, currentBalanceCents, originalBalanceCents, interestRate, minimumPaymentCents, monthlyPaymentCents, paymentDay, maturityDate, linkedAccountId, notes });
export const updateLiability = (id: string, name: string, liabilityType: string, institution: string | null, currentBalanceCents: number, originalBalanceCents: number | null, interestRate: number | null, minimumPaymentCents: number | null, monthlyPaymentCents: number | null, paymentDay: number | null, maturityDate: string | null, linkedAccountId: string | null, notes: string | null) =>
  invoke<void>("update_liability", { id, name, liabilityType, institution, currentBalanceCents, originalBalanceCents, interestRate, minimumPaymentCents, monthlyPaymentCents, paymentDay, maturityDate, linkedAccountId, notes });
export const deleteLiability = (id: string) => invoke<void>("delete_liability", { id });

export const getNetWorthSummary = () => invoke<NetWorthSummary>("get_net_worth_summary");
export const getNetWorthHistory = (months: number) => invoke<NetWorthSnapshot[]>("get_net_worth_history", { months });
export const takeNetWorthSnapshot = () => invoke<void>("take_net_worth_snapshot");
export const syncAssetFromAccount = (assetId: string) => invoke<void>("sync_asset_from_account", { assetId });

// Budgets
export const getBudgets = () => invoke<BudgetWithSpending[]>("get_budgets");
export const setBudget = (categoryId: string, monthlyLimitCents: number) =>
  invoke<Budget>("set_budget", { categoryId, monthlyLimitCents });
export const deleteBudget = (id: string) => invoke<void>("delete_budget", { id });
export const getBudgetStatus = (month: string) => invoke<BudgetStatus>("get_budget_status", { month });
export const getSavingsRateHistory = (months: number) => invoke<SavingsRatePoint[]>("get_savings_rate_history", { months });
export const suggestBudgets = () => invoke<BudgetWithSpending[]>("suggest_budgets");

// Goals
export const getGoals = () => invoke<GoalWithProgress[]>("get_goals");
export const createGoal = (name: string, goalType: string, targetCents: number, currentCents: number, monthlyContributionCents: number, targetDate: string | null, priority: number, linkedAssetId: string | null, icon: string | null, color: string | null, notes: string | null) =>
  invoke<Goal>("create_goal", { name, goalType, targetCents, currentCents, monthlyContributionCents, targetDate, priority, linkedAssetId, icon, color, notes });
export const updateGoal = (id: string, name: string, goalType: string, targetCents: number, currentCents: number, monthlyContributionCents: number, targetDate: string | null, priority: number, icon: string | null, color: string | null, notes: string | null, status: string) =>
  invoke<void>("update_goal", { id, name, goalType, targetCents, currentCents, monthlyContributionCents, targetDate, priority, icon, color, notes, status });
export const deleteGoal = (id: string) => invoke<void>("delete_goal", { id });
export const updateGoalProgress = (id: string, currentCents: number) =>
  invoke<void>("update_goal_progress", { id, currentCents });
export const getEmergencyFundTarget = () => invoke<number>("get_emergency_fund_target");

// Retirement
export const getRetirementProfile = () => invoke<RetirementProfile>("get_retirement_profile");
export const getRetirementProfileState = () => invoke<RetirementProfileState>("get_retirement_profile_state");
export const saveRetirementProfile = (currentAge: number, retirementAge: number, lifeExpectancy: number, annualIncomeCents: number | null, incomeGrowthRate: number, ssMonthlyBenefitCents: number | null, ssClaimingAge: number, retirementSpendingRate: number, inflationRate: number, preRetirementReturn: number, postRetirementReturn: number, withdrawalRate: number, effectiveTaxRate: number, stateName: string | null, filingStatus: string) =>
  invoke<void>("save_retirement_profile", { currentAge, retirementAge, lifeExpectancy, annualIncomeCents, incomeGrowthRate, ssMonthlyBenefitCents, ssClaimingAge, retirementSpendingRate, inflationRate, preRetirementReturn, postRetirementReturn, withdrawalRate, effectiveTaxRate, stateName, filingStatus });
export const runRetirementProjection = (overridesJson?: string) =>
  invoke<RetirementProjection>("run_retirement_projection", { overridesJson: overridesJson ?? null });
export const getRequiredSavingsRate = (targetAge: number) =>
  invoke<number>("get_required_savings_rate", { targetAge });
export const getSsComparison = () => invoke<[number, number, number][]>("get_ss_comparison");
export const saveRetirementScenario = (name: string, description: string | null, overridesJson: string) =>
  invoke<RetirementScenario>("save_retirement_scenario", { name, description, overridesJson });
export const getRetirementScenarios = () => invoke<RetirementScenario[]>("get_retirement_scenarios");

// Insights
export const getInsights = (unreadOnly: boolean) => invoke<Insight[]>("get_insights", { unreadOnly });
export const dismissInsight = (id: string) => invoke<void>("dismiss_insight", { id });
export const markInsightRead = (id: string) => invoke<void>("mark_insight_read", { id });
export const generateInsights = () => invoke<Insight[]>("generate_insights");
export const getInsightDataForAi = () => invoke<string>("get_insight_data_for_ai");

// Forecasting
export const getCashFlowForecast = (months: number) => invoke<ForecastPoint[]>("get_cash_flow_forecast", { months });
export const getUpcomingBills = (days: number) => invoke<UpcomingBill[]>("get_upcoming_bills", { days });
export const getSeasonalPatterns = () => invoke<SeasonalPattern[]>("get_seasonal_patterns");
export const calculateDebtPayoff = (strategy: string, extraMonthlyCents: number) =>
  invoke<DebtPayoffPlan>("calculate_debt_payoff", { strategy, extraMonthlyCents });

// Investment Import
export const previewInvestmentCsv = (filePath: string) =>
  invoke<ImportedHolding[]>("preview_investment_csv", { filePath });
export const importInvestmentCsv = (filePath: string) =>
  invoke<InvestmentImportResult>("import_investment_csv", { filePath });
