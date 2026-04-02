import type { Page } from "@playwright/test";

type MockMap = Record<string, unknown>;

export function createMockResponses(overrides: MockMap = {}): MockMap {
  return {
    get_accounts: [],
    get_account_balances: [],
    get_cash_flow_summary: null,
    get_sankey_data: {
      nodes: [],
      links: [],
    },
    get_spending_by_category: [],
    get_spending_breakdown: {
      months: [],
      categories: [],
      monthly_totals: [],
      grand_total: 0,
    },
    get_spending_trends: [],
    get_fixed_costs: {
      months: [],
      items: [],
      monthly_totals: [],
      total_monthly_avg: 0,
    },
    get_top_merchants: [],
    get_insights: [],
    get_insight_data_for_ai: "",
    get_goals: [],
    get_net_worth_summary: null,
    get_net_worth_history: [],
    get_assets: [],
    get_cash_flow_forecast: [],
    get_upcoming_bills: [],
    get_seasonal_patterns: [],
    get_liabilities: [],
    get_budgets: [],
    get_budget_status: {
      budgets: [],
      total_budgeted: 0,
      total_spent: 0,
      unbudgeted_spending: 0,
      savings_rate: 0,
      income: 0,
    },
    get_savings_rate_history: [],
    suggest_budgets: [],
    get_retirement_profile_state: {
      profile: {
        current_age: 35,
        retirement_age: 65,
        life_expectancy: 90,
        annual_income_cents: 0,
        income_growth_rate: 0.03,
        ss_monthly_benefit_cents: 0,
        ss_claiming_age: 67,
        retirement_spending_rate: 0.8,
        inflation_rate: 0.03,
        pre_retirement_return: 0.07,
        post_retirement_return: 0.05,
        withdrawal_rate: 0.04,
        effective_tax_rate: 0.22,
        state: null,
        filing_status: "married_filing_jointly",
      },
      has_saved_profile: false,
    },
    run_retirement_projection: {
      success_probability: 0,
      median_portfolio_at_retirement: 0,
      monthly_retirement_income: 0,
      years_funded_median: 0,
      required_monthly_savings: 0,
      percentiles: [],
      yearly_data: [],
    },
    get_ss_comparison: [],
    get_retirement_scenarios: [],
    calculate_debt_payoff: {
      strategy: "avalanche",
      total_interest: 0,
      payoff_date: "2027-01-01",
      monthly_payment: 0,
      debts: [],
    },
    get_teller_config: {
      is_configured: false,
      environment: "sandbox",
      app_id: "",
    },
    get_storage_info: {
      profile: "default",
      is_default_profile: true,
      app_data_dir: "C:\\Users\\patri\\AppData\\Roaming\\com.perfi.app",
      db_path: "C:\\Users\\patri\\AppData\\Roaming\\com.perfi.app\\perfi.db",
    },
    get_categories: [],
    get_transactions: [],
    get_transaction_count: 0,
    get_category_rules: [],
    get_csv_formats: [],
    preview_csv: [],
    import_csv: {
      imported: 0,
      duplicates: 0,
      categorized: 0,
      errors: [],
    },
    ...overrides,
  };
}

export async function mountPerfi(page: Page, path: string, overrides: MockMap = {}) {
  const responses = createMockResponses(overrides);
  await page.addInitScript(
    ({ mockResponses }) => {
      localStorage.setItem("perfi-theme", "dark");
      window.__PERFI_TEST_INVOKE__ = async (command: string, args?: Record<string, unknown>) => {
        if (command === "update_transaction_planning_exclusion") {
          const transactions = Array.isArray(mockResponses.get_transactions)
            ? (mockResponses.get_transactions as Array<Record<string, unknown>>)
            : [];
          const transactionId = args?.transactionId;
          const excludeFromPlanning = args?.excludeFromPlanning;
          mockResponses.get_transactions = transactions.map((tx) =>
            tx.id === transactionId
              ? { ...tx, exclude_from_planning: Boolean(excludeFromPlanning) }
              : tx
          );
          return undefined;
        }
        if (command === "update_category_planning_exclusion") {
          const categories = Array.isArray(mockResponses.get_categories)
            ? (mockResponses.get_categories as Array<Record<string, unknown>>)
            : [];
          const categoryId = args?.categoryId;
          const excludeFromPlanning = args?.excludeFromPlanning;
          mockResponses.get_categories = categories.map((category) =>
            category.id === categoryId
              ? { ...category, exclude_from_planning: Boolean(excludeFromPlanning) }
              : category
          );
          return undefined;
        }
        if (!(command in mockResponses)) {
          throw new Error(`No Playwright mock registered for ${command}`);
        }
        return mockResponses[command];
      };
    },
    { mockResponses: responses }
  );

  await page.goto(path);
}
