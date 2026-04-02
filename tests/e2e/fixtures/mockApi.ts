import type { Page } from "@playwright/test";

type MockMap = Record<string, unknown>;

export function createMockResponses(overrides: MockMap = {}): MockMap {
  return {
    get_accounts: [],
    get_account_balances: [],
    get_cash_flow_summary: null,
    get_spending_by_category: [],
    get_spending_trends: [],
    get_top_merchants: [],
    get_insights: [],
    get_goals: [],
    get_net_worth_summary: null,
    get_cash_flow_forecast: [],
    get_upcoming_bills: [],
    get_seasonal_patterns: [],
    get_liabilities: [],
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
