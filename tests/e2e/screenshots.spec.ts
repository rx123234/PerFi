import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { mountPerfi } from "./fixtures/mockApi";

const OUTPUT_DIR = path.resolve(process.cwd(), "screenshots", "fake-data");

function category(id: string, name: string, color: string, exclude = false) {
  return { id, name, parent_id: null, color, icon: null, exclude_from_planning: exclude };
}

function budget(categoryId: string, categoryName: string, color: string, limit: number, spent: number) {
  return {
    budget: {
      id: `budget-${categoryId}`,
      category_id: categoryId,
      category_name: categoryName,
      category_color: color,
      monthly_limit_cents: limit * 100,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    spent_cents: spent * 100,
    remaining_cents: (limit - spent) * 100,
    percentage: (spent / limit) * 100,
  };
}

const categories = [
  category("cat-housing", "Housing", "#3b82f6"),
  category("cat-food", "Groceries", "#14b8a6"),
  category("cat-dining", "Dining", "#f97316"),
  category("cat-kids", "Childcare", "#8b5cf6"),
  category("cat-travel", "Travel", "#ef4444", true),
  category("cat-health", "Health", "#f59e0b"),
  category("cat-utilities", "Utilities", "#22c55e"),
  category("cat-fun", "Fun Money", "#ec4899"),
  category("cat-uncategorized", "Uncategorized", "#94a3b8"),
];

const budgets = [
  budget("cat-housing", "Housing", "#3b82f6", 2500, 2450),
  budget("cat-food", "Groceries", "#14b8a6", 1200, 1180),
  budget("cat-dining", "Dining", "#f97316", 650, 720),
  budget("cat-kids", "Childcare", "#8b5cf6", 1000, 980),
];

const forecast = [
  ["2026-05", 12340, 8890, 3450, 1400, 5100, 0.82],
  ["2026-06", 12340, 9140, 3200, 950, 4975, 0.78],
  ["2026-07", 12340, 9620, 2720, 300, 4680, 0.74],
  ["2026-08", 12340, 9870, 2470, -120, 4510, 0.69],
  ["2026-09", 12550, 9330, 3220, 620, 5010, 0.67],
  ["2026-10", 12550, 9180, 3370, 900, 5200, 0.65],
].map(([month, projected_income, projected_spending, projected_net, net_p10, net_p90, confidence]) => ({
  month,
  projected_income,
  projected_spending,
  projected_net,
  net_p10,
  net_p90,
  confidence,
}));

const fakeData = {
  get_accounts: [
    { id: "acc-checking", name: "Household Checking", institution: "Northwind Bank", account_type: "checking", teller_account_id: "teller-checking", teller_enrollment_id: "enroll-1", mask: "4821", source: "teller", created_at: "2026-03-01T10:00:00Z" },
    { id: "acc-savings", name: "Emergency Fund", institution: "Northwind Bank", account_type: "savings", teller_account_id: null, teller_enrollment_id: null, mask: "1190", source: "manual", created_at: "2026-03-01T10:00:00Z" },
    { id: "acc-card", name: "Everyday Card", institution: "Summit Card", account_type: "credit_card", teller_account_id: "teller-card", teller_enrollment_id: "enroll-2", mask: "3102", source: "teller", created_at: "2026-03-01T10:00:00Z" },
  ],
  get_account_balances: [
    { account_id: "acc-checking", account_name: "Household Checking", account_type: "checking", institution: "Northwind Bank", balance: 12480.22, mask: "4821" },
    { account_id: "acc-savings", account_name: "Emergency Fund", account_type: "savings", institution: "Northwind Bank", balance: 18250, mask: "1190" },
    { account_id: "acc-card", account_name: "Everyday Card", account_type: "credit_card", institution: "Summit Card", balance: -1632.42, mask: "3102" },
  ],
  get_cash_flow_summary: { income: 12340, spending: 8415, net: 3925, prev_income: 11820, prev_spending: 8742, prev_net: 3078 },
  get_sankey_data: {
    nodes: [{ name: "Income" }, { name: "Housing" }, { name: "Groceries" }, { name: "Lifestyle" }, { name: "Savings" }, { name: "Debt" }],
    links: [
      { source: 0, target: 1, value: 2450 },
      { source: 0, target: 2, value: 1180 },
      { source: 0, target: 3, value: 1775 },
      { source: 0, target: 4, value: 3925 },
      { source: 0, target: 5, value: 1010 },
    ],
  },
  get_spending_by_category: [
    { category_id: "cat-housing", category_name: "Housing", color: "#3b82f6", amount: 2450, percentage: 29.1 },
    { category_id: "cat-food", category_name: "Groceries", color: "#14b8a6", amount: 1180, percentage: 14.0 },
    { category_id: "cat-dining", category_name: "Dining", color: "#f97316", amount: 720, percentage: 8.6 },
    { category_id: "cat-kids", category_name: "Childcare", color: "#8b5cf6", amount: 980, percentage: 11.6 },
    { category_id: "cat-travel", category_name: "Travel", color: "#ef4444", amount: 640, percentage: 7.6 },
    { category_id: "cat-health", category_name: "Health", color: "#f59e0b", amount: 560, percentage: 6.6 },
    { category_id: "cat-utilities", category_name: "Utilities", color: "#22c55e", amount: 470, percentage: 5.6 },
    { category_id: "cat-fun", category_name: "Fun Money", color: "#ec4899", amount: 415, percentage: 4.9 },
  ],
  get_spending_breakdown: {
    months: ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"],
    categories: [
      { name: "Housing", color: "#3b82f6", amounts: [2380, 2410, 2440, 2450, 2450, 2450], total: 14580 },
      { name: "Groceries", color: "#14b8a6", amounts: [920, 980, 1040, 1095, 1130, 1180], total: 6345 },
      { name: "Dining", color: "#f97316", amounts: [510, 560, 610, 660, 690, 720], total: 3750 },
      { name: "Travel", color: "#ef4444", amounts: [210, 480, 120, 0, 540, 640], total: 1990 },
      { name: "Childcare", color: "#8b5cf6", amounts: [910, 930, 940, 950, 965, 980], total: 5675 },
    ],
    monthly_totals: [4930, 5360, 5150, 5155, 5775, 5970],
    grand_total: 32340,
  },
  get_spending_trends: [
    { period: "Jan", income: 11800, spending: 8120, categories: [] },
    { period: "Feb", income: 12040, spending: 8340, categories: [] },
    { period: "Mar", income: 12150, spending: 8210, categories: [] },
    { period: "Apr", income: 12340, spending: 8415, categories: [] },
  ],
  get_fixed_costs: {
    months: ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"],
    items: [
      { merchant: "Northwind Mortgage", category: "Housing", color: "#3b82f6", amounts: [2450, 2450, 2450, 2450, 2450, 2450], avg_amount: 2450, frequency: 6 },
      { merchant: "BrightPath Childcare", category: "Childcare", color: "#8b5cf6", amounts: [920, 930, 940, 950, 965, 980], avg_amount: 947.5, frequency: 6 },
      { merchant: "Northwind Electric", category: "Utilities", color: "#22c55e", amounts: [190, 225, 210, 205, 220, 215], avg_amount: 210.83, frequency: 6 },
      { merchant: "StreamWave", category: "Entertainment", color: "#ec4899", amounts: [18, 18, 18, 18, 18, 18], avg_amount: 18, frequency: 6 },
      { merchant: "City Water", category: "Utilities", color: "#22c55e", amounts: [74, 77, 81, 76, 79, 82], avg_amount: 78.17, frequency: 6 },
      { merchant: "FiberFast", category: "Utilities", color: "#22c55e", amounts: [89, 89, 89, 89, 89, 89], avg_amount: 89, frequency: 6 },
    ],
    monthly_totals: [3741, 3789, 3788, 3788, 3821, 3834],
    total_monthly_avg: 3793.5,
  },
  get_top_merchants: [
    { merchant: "Northwind Mortgage", amount: 2450, count: 1 },
    { merchant: "BrightPath Childcare", amount: 980, count: 1 },
    { merchant: "Whole Harvest Market", amount: 624, count: 8 },
    { merchant: "JetBlue", amount: 540, count: 1 },
    { merchant: "Blue Bottle", amount: 212, count: 9 },
    { merchant: "Northwind Electric", amount: 215, count: 1 },
    { merchant: "Target", amount: 198, count: 3 },
    { merchant: "FiberFast", amount: 89, count: 1 },
  ],
  get_categories: categories,
  get_transactions: [
    { id: "tx-1", account_id: "acc-checking", date: "2026-04-01", amount: -2450, description: "Northwind Mortgage", enriched_desc: null, category_id: "cat-housing", category_name: "Housing", merchant: "Northwind Mortgage", source: "teller", pending: false, exclude_from_planning: false, created_at: "2026-04-01T08:00:00Z" },
    { id: "tx-2", account_id: "acc-card", date: "2026-04-02", amount: -142.72, description: "Whole Harvest Market", enriched_desc: null, category_id: "cat-food", category_name: "Groceries", merchant: "Whole Harvest Market", source: "teller", pending: false, exclude_from_planning: false, created_at: "2026-04-02T08:00:00Z" },
    { id: "tx-3", account_id: "acc-card", date: "2026-04-03", amount: -540, description: "JetBlue", enriched_desc: null, category_id: "cat-travel", category_name: "Travel", merchant: "JetBlue", source: "teller", pending: false, exclude_from_planning: true, created_at: "2026-04-03T08:00:00Z" },
    { id: "tx-4", account_id: "acc-checking", date: "2026-04-05", amount: 6170, description: "Payroll", enriched_desc: null, category_id: null, category_name: null, merchant: "Northwind Payroll", source: "teller", pending: false, exclude_from_planning: false, created_at: "2026-04-05T08:00:00Z" },
    { id: "tx-5", account_id: "acc-checking", date: "2026-04-06", amount: -980, description: "BrightPath Childcare", enriched_desc: null, category_id: "cat-kids", category_name: "Childcare", merchant: "BrightPath Childcare", source: "manual", pending: false, exclude_from_planning: false, created_at: "2026-04-06T08:00:00Z" },
    { id: "tx-6", account_id: "acc-card", date: "2026-04-07", amount: -28.5, description: "Blue Bottle", enriched_desc: null, category_id: "cat-dining", category_name: "Dining", merchant: "Blue Bottle", source: "teller", pending: true, exclude_from_planning: false, created_at: "2026-04-07T08:00:00Z" },
  ],
  get_transaction_count: 6,
  get_category_rules: [
    { id: "rule-1", pattern: "WHOLE HARVEST", category_id: "cat-food", category_name: "Groceries", priority: 10 },
    { id: "rule-2", pattern: "BLUE BOTTLE", category_id: "cat-dining", category_name: "Dining", priority: 10 },
    { id: "rule-3", pattern: "JETBLUE", category_id: "cat-travel", category_name: "Travel", priority: 9 },
  ],
  get_csv_formats: [
    { name: "Chase Checking CSV", date_column: "Posting Date", date_format: "%m/%d/%Y", description_column: "Description", amount_column: "Amount", debit_column: null, credit_column: null, amount_inverted: false },
  ],
  preview_csv: [
    { date: "2026-03-26", description: "Whole Harvest Market", amount: -123.84 },
    { date: "2026-03-27", description: "Northwind Payroll", amount: 6170 },
    { date: "2026-03-28", description: "Blue Bottle", amount: -19.42 },
  ],
  import_csv: { imported: 31, duplicates: 3, categorized: 22, errors: [] },
  get_budgets: budgets,
  get_budget_status: {
    budgets,
    total_budgeted: 535000,
    total_spent: 533000,
    unbudgeted_spending: 167000,
    savings_rate: 24.8,
    income: 1234000,
  },
  get_savings_rate_history: [
    { month: "2025-11", income: 11500, spending: 8350, savings_rate: 27.4 },
    { month: "2025-12", income: 11620, spending: 8940, savings_rate: 23.1 },
    { month: "2026-01", income: 11840, spending: 8610, savings_rate: 27.3 },
    { month: "2026-02", income: 12020, spending: 8450, savings_rate: 29.7 },
    { month: "2026-03", income: 12110, spending: 8680, savings_rate: 28.3 },
    { month: "2026-04", income: 12340, spending: 9278, savings_rate: 24.8 },
  ],
  suggest_budgets: [
    budget("cat-health", "Health", "#f59e0b", 600, 560),
  ],
  get_goals: [
    {
      goal: { id: "goal-house", name: "House Down Payment", goal_type: "savings", target_cents: 1500000, current_cents: 570000, monthly_contribution_cents: 25000, target_date: "2028-06-01", priority: 1, linked_asset_id: null, icon: null, color: "#3b82f6", notes: null, status: "active", completed_at: null, created_at: "2025-08-01T00:00:00Z" },
      percentage: 38,
      projected_completion_date: "2028-07-01",
      on_track: true,
      months_remaining: 27,
    },
    {
      goal: { id: "goal-trip", name: "Summer Japan Trip", goal_type: "travel", target_cents: 600000, current_cents: 460000, monthly_contribution_cents: 35000, target_date: "2026-08-01", priority: 2, linked_asset_id: null, icon: null, color: "#f97316", notes: null, status: "active", completed_at: null, created_at: "2025-12-01T00:00:00Z" },
      percentage: 76.7,
      projected_completion_date: "2026-08-01",
      on_track: true,
      months_remaining: 4,
    },
    {
      goal: { id: "goal-rainy", name: "Emergency Fund Target", goal_type: "emergency", target_cents: 2000000, current_cents: 1825000, monthly_contribution_cents: 15000, target_date: "2027-01-01", priority: 3, linked_asset_id: "asset-savings", icon: null, color: "#14b8a6", notes: null, status: "active", completed_at: null, created_at: "2025-05-01T00:00:00Z" },
      percentage: 91.25,
      projected_completion_date: "2026-12-01",
      on_track: false,
      months_remaining: 8,
    },
  ],
  get_net_worth_summary: {
    total_assets: 486250,
    total_liabilities: 217900,
    net_worth: 268350,
    prev_net_worth: 259100,
    assets_by_type: [
      { asset_type: "Cash", total: 30730, count: 2 },
      { asset_type: "Investment", total: 214500, count: 2 },
      { asset_type: "Retirement", total: 241020, count: 2 },
    ],
    liabilities_by_type: [
      { liability_type: "Mortgage", total: 182000, count: 1 },
      { liability_type: "Credit Card", total: 4300, count: 1 },
      { liability_type: "Student Loan", total: 31600, count: 1 },
    ],
  },
  get_net_worth_history: [
    { id: "nw-1", snapshot_date: "2025-05-01", total_assets_cents: 43100000, total_liabilities_cents: 22850000, net_worth_cents: 20250000, breakdown_json: null, created_at: "2025-05-01T00:00:00Z" },
    { id: "nw-2", snapshot_date: "2025-07-01", total_assets_cents: 43850000, total_liabilities_cents: 22640000, net_worth_cents: 21210000, breakdown_json: null, created_at: "2025-07-01T00:00:00Z" },
    { id: "nw-3", snapshot_date: "2025-09-01", total_assets_cents: 44620000, total_liabilities_cents: 22410000, net_worth_cents: 22210000, breakdown_json: null, created_at: "2025-09-01T00:00:00Z" },
    { id: "nw-4", snapshot_date: "2025-11-01", total_assets_cents: 45840000, total_liabilities_cents: 22160000, net_worth_cents: 23680000, breakdown_json: null, created_at: "2025-11-01T00:00:00Z" },
    { id: "nw-5", snapshot_date: "2026-01-01", total_assets_cents: 46980000, total_liabilities_cents: 21980000, net_worth_cents: 25000000, breakdown_json: null, created_at: "2026-01-01T00:00:00Z" },
    { id: "nw-6", snapshot_date: "2026-03-01", total_assets_cents: 47830000, total_liabilities_cents: 21920000, net_worth_cents: 25910000, breakdown_json: null, created_at: "2026-03-01T00:00:00Z" },
    { id: "nw-7", snapshot_date: "2026-04-01", total_assets_cents: 48625000, total_liabilities_cents: 21790000, net_worth_cents: 26835000, breakdown_json: null, created_at: "2026-04-01T00:00:00Z" },
  ],
  get_assets: [
    { id: "asset-savings", name: "Emergency Savings", asset_type: "Cash", institution: "Northwind Bank", current_value_cents: 1825000, ticker: null, shares: null, cost_basis_cents: null, purchase_price_cents: null, purchase_date: null, tax_treatment: null, contribution_ytd_cents: 0, contribution_limit_cents: null, notes: null, is_manual: true, linked_account_id: "acc-savings", updated_at: "2026-04-01T00:00:00Z", created_at: "2025-05-01T00:00:00Z" },
    { id: "asset-brokerage", name: "Index Fund Portfolio", asset_type: "Investment", institution: "Fidelity", current_value_cents: 21450000, ticker: "VTI", shares: 202.4, cost_basis_cents: 18100000, purchase_price_cents: 8900, purchase_date: "2023-01-05", tax_treatment: null, contribution_ytd_cents: 0, contribution_limit_cents: null, notes: "Imported from Fidelity - Taxable Brokerage", is_manual: false, linked_account_id: null, updated_at: "2026-04-01T00:00:00Z", created_at: "2023-01-05T00:00:00Z" },
    { id: "asset-401k", name: "401(k)", asset_type: "Retirement", institution: "Fidelity", current_value_cents: 16500000, ticker: null, shares: null, cost_basis_cents: null, purchase_price_cents: null, purchase_date: null, tax_treatment: "traditional", contribution_ytd_cents: 920000, contribution_limit_cents: 2300000, notes: null, is_manual: false, linked_account_id: null, updated_at: "2026-04-01T00:00:00Z", created_at: "2020-05-01T00:00:00Z" },
    { id: "asset-roth", name: "Roth IRA", asset_type: "Retirement", institution: "Vanguard", current_value_cents: 7602000, ticker: null, shares: null, cost_basis_cents: null, purchase_price_cents: null, purchase_date: null, tax_treatment: "roth", contribution_ytd_cents: 240000, contribution_limit_cents: 700000, notes: null, is_manual: false, linked_account_id: null, updated_at: "2026-04-01T00:00:00Z", created_at: "2018-02-01T00:00:00Z" },
  ],
  get_liabilities: [
    { id: "liab-mortgage", name: "Home Mortgage", liability_type: "Mortgage", institution: "Northwind Home Loans", current_balance_cents: 18200000, original_balance_cents: 24000000, interest_rate: 0.0525, minimum_payment_cents: 245000, monthly_payment_cents: 245000, payment_day: 1, maturity_date: "2052-05-01", linked_account_id: null, notes: null, updated_at: "2026-04-01T00:00:00Z", created_at: "2022-05-01T00:00:00Z" },
    { id: "liab-student", name: "Graduate Loan", liability_type: "Student Loan", institution: "Federal Student Aid", current_balance_cents: 3160000, original_balance_cents: 4850000, interest_rate: 0.041, minimum_payment_cents: 38000, monthly_payment_cents: 42000, payment_day: 12, maturity_date: "2034-09-01", linked_account_id: null, notes: null, updated_at: "2026-04-01T00:00:00Z", created_at: "2019-09-01T00:00:00Z" },
    { id: "liab-card", name: "Everyday Card", liability_type: "Credit Card", institution: "Summit Card", current_balance_cents: 430000, original_balance_cents: 430000, interest_rate: 0.199, minimum_payment_cents: 6500, monthly_payment_cents: 20000, payment_day: 24, maturity_date: null, linked_account_id: "acc-card", notes: null, updated_at: "2026-04-01T00:00:00Z", created_at: "2026-02-01T00:00:00Z" },
  ],
  get_retirement_profile_state: {
    profile: { current_age: 35, retirement_age: 62, life_expectancy: 92, annual_income_cents: 18500000, income_growth_rate: 0.03, ss_monthly_benefit_cents: 320000, ss_claiming_age: 67, retirement_spending_rate: 0.78, inflation_rate: 0.028, pre_retirement_return: 0.07, post_retirement_return: 0.045, withdrawal_rate: 0.04, effective_tax_rate: 0.22, state: "CA", filing_status: "married_filing_jointly" },
    has_saved_profile: true,
  },
  run_retirement_projection: {
    success_probability: 0.84,
    median_portfolio_at_retirement: 2450000,
    monthly_retirement_income: 10400,
    years_funded_median: 31,
    required_monthly_savings: 1900,
    percentiles: [
      { percentile: 10, portfolio_at_retirement: 1420000, years_funded: 23, monthly_income: 8100 },
      { percentile: 50, portfolio_at_retirement: 2450000, years_funded: 31, monthly_income: 10400 },
      { percentile: 90, portfolio_at_retirement: 3980000, years_funded: 37, monthly_income: 13900 },
    ],
    yearly_data: [
      { age: 35, year: 2026, p10: 268350, p25: 268350, p50: 268350, p75: 268350, p90: 268350 },
      { age: 40, year: 2031, p10: 410000, p25: 480000, p50: 560000, p75: 650000, p90: 760000 },
      { age: 45, year: 2036, p10: 620000, p25: 760000, p50: 910000, p75: 1100000, p90: 1320000 },
      { age: 50, year: 2041, p10: 910000, p25: 1120000, p50: 1350000, p75: 1630000, p90: 1960000 },
      { age: 55, year: 2046, p10: 1230000, p25: 1560000, p50: 1880000, p75: 2270000, p90: 2730000 },
      { age: 60, year: 2051, p10: 1510000, p25: 1940000, p50: 2360000, p75: 2870000, p90: 3460000 },
      { age: 62, year: 2053, p10: 1600000, p25: 2030000, p50: 2450000, p75: 3010000, p90: 3620000 },
      { age: 70, year: 2061, p10: 1180000, p25: 1650000, p50: 2240000, p75: 2910000, p90: 3700000 },
      { age: 80, year: 2071, p10: 640000, p25: 1130000, p50: 1820000, p75: 2700000, p90: 3750000 },
      { age: 90, year: 2081, p10: 110000, p25: 480000, p50: 1260000, p75: 2390000, p90: 3830000 },
    ],
  },
  get_ss_comparison: [[62, 2450, 29400], [67, 3200, 38400], [70, 4010, 48120]],
  get_retirement_scenarios: [
    { id: "scen-1", name: "Retire at 60", description: "Earlier retirement with current savings rate", overrides_json: "{\"retirement_age\":60}", result_json: null, created_at: "2026-03-30T00:00:00Z" },
    { id: "scen-2", name: "Increase savings", description: "Higher monthly savings to build cushion", overrides_json: "{\"withdrawal_rate\":0.038,\"retirement_age\":63}", result_json: null, created_at: "2026-03-31T00:00:00Z" },
  ],
  get_insights: [
    { id: "insight-1", insight_type: "spending_alert", title: "Dining is running ahead of plan", body: "Dining spend is 19% above the trailing three-month baseline. Most of the jump is from weekday coffee and lunch purchases.", severity: "medium", data_json: null, is_read: false, is_dismissed: false, expires_at: null, created_at: "2026-04-02T07:00:00Z" },
    { id: "insight-2", insight_type: "savings_trend", title: "Savings rate is still healthy", body: "Even with travel this month, savings rate is tracking near 25%, which keeps the house goal on pace.", severity: "info", data_json: null, is_read: false, is_dismissed: false, expires_at: null, created_at: "2026-04-01T18:00:00Z" },
    { id: "insight-3", insight_type: "milestone", title: "Net worth crossed $250k", body: "You moved past the $250k net worth mark after the latest retirement contribution and mortgage paydown.", severity: "info", data_json: null, is_read: true, is_dismissed: false, expires_at: null, created_at: "2026-03-28T12:00:00Z" },
  ],
  get_insight_data_for_ai: `Section: all
Snapshot month: 2026-04
Net worth: $268,350
Projected next-month net: $3,450
Likely forecast range: $1,400 to $5,100
Top spend drivers: Housing, Groceries, Childcare`,
  get_cash_flow_forecast: forecast,
  get_upcoming_bills: [
    { merchant: "Northwind Mortgage", expected_amount: 2450, expected_date: "2026-04-05", category: "Housing", confidence: 0.96 },
    { merchant: "BrightPath Childcare", expected_amount: 980, expected_date: "2026-04-09", category: "Childcare", confidence: 0.91 },
    { merchant: "Summit Card Payment", expected_amount: 420, expected_date: "2026-04-16", category: "Debt", confidence: 0.8 },
    { merchant: "Northwind Electric", expected_amount: 215, expected_date: "2026-04-20", category: "Utilities", confidence: 0.84 },
  ],
  get_seasonal_patterns: [
    { month: 1, month_name: "January", avg_spending: 8120, vs_annual_avg: -0.02 },
    { month: 2, month_name: "February", avg_spending: 8340, vs_annual_avg: 0.01 },
    { month: 3, month_name: "March", avg_spending: 8210, vs_annual_avg: -0.01 },
    { month: 4, month_name: "April", avg_spending: 8415, vs_annual_avg: 0.03 },
    { month: 5, month_name: "May", avg_spending: 8600, vs_annual_avg: 0.05 },
    { month: 6, month_name: "June", avg_spending: 8920, vs_annual_avg: 0.09 },
    { month: 7, month_name: "July", avg_spending: 9730, vs_annual_avg: 0.19 },
    { month: 8, month_name: "August", avg_spending: 9340, vs_annual_avg: 0.14 },
    { month: 9, month_name: "September", avg_spending: 8460, vs_annual_avg: 0.04 },
    { month: 10, month_name: "October", avg_spending: 8280, vs_annual_avg: 0.01 },
    { month: 11, month_name: "November", avg_spending: 9150, vs_annual_avg: 0.11 },
    { month: 12, month_name: "December", avg_spending: 9890, vs_annual_avg: 0.2 },
  ],
  calculate_debt_payoff: {
    strategy: "avalanche",
    total_interest: 11400,
    payoff_date: "2029-11-01",
    monthly_payment: 3070,
    debts: [
      { liability_id: "liab-card", name: "Everyday Card", current_balance: 4300, interest_rate: 0.199, payoff_date: "2026-07-01", total_interest: 180, monthly_payments: [] },
      { liability_id: "liab-student", name: "Graduate Loan", current_balance: 31600, interest_rate: 0.041, payoff_date: "2029-11-01", total_interest: 3200, monthly_payments: [] },
      { liability_id: "liab-mortgage", name: "Home Mortgage", current_balance: 182000, interest_rate: 0.0525, payoff_date: "2052-05-01", total_interest: 8020, monthly_payments: [] },
    ],
  },
  get_teller_config: { is_configured: true, environment: "sandbox", app_id: "app_demo_123" },
  get_storage_info: {
    profile: "screenshots",
    is_default_profile: false,
    app_data_dir: "C:\\Users\\patri\\AppData\\Roaming\\com.perfi.app\\profiles\\screenshots",
    db_path: "C:\\Users\\patri\\AppData\\Roaming\\com.perfi.app\\profiles\\screenshots\\perfi.db",
  },
};

async function readyPage(page: Parameters<typeof mountPerfi>[0], marker: string) {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
  await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(350);
}

const captures = [
  { route: "/", heading: "Home", file: "01-home-dashboard.png" },
  { route: "/transactions", heading: "Transactions", file: "02-transactions.png" },
  { route: "/spending", heading: "Spending", file: "03-spending.png" },
  { route: "/budget", heading: "Budget", file: "04-budget.png" },
  { route: "/fixed-costs", heading: "Fixed Costs", file: "05-fixed-costs.png" },
  { route: "/money-flow", heading: "Money Flow", file: "06-money-flow.png" },
  { route: "/net-worth", heading: "Net Worth", file: "07-net-worth.png" },
  { route: "/goals", heading: "Goals", file: "08-goals.png" },
  { route: "/retirement", heading: "Retirement", file: "09-retirement.png" },
  { route: "/forecast", heading: "Plan around expected cash flow, not guesswork.", file: "10-forecast.png" },
  { route: "/insights", heading: "Insights", file: "11-insights.png" },
  { route: "/accounts", heading: "Accounts", file: "12-accounts.png" },
  { route: "/settings", heading: "Settings", file: "13-settings-general.png" },
];

test.describe("fake-data screenshot pack", () => {
  for (const capture of captures) {
    test(`captures ${capture.file}`, async ({ page }) => {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      await mountPerfi(page, capture.route, fakeData);
      await readyPage(page, capture.heading);
      await page.screenshot({ path: path.join(OUTPUT_DIR, capture.file), fullPage: true });
    });
  }

  test("captures settings tabs", async ({ page }) => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    await mountPerfi(page, "/settings", fakeData);
    await readyPage(page, "Settings");

    await page.getByRole("button", { name: "Categories", exact: true }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "14-settings-categories.png"), fullPage: true });

    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "15-settings-import.png"), fullPage: true });
  });
});
