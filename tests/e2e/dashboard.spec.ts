import { expect, test } from "@playwright/test";
import { mountPerfi } from "./fixtures/mockApi";

test.describe("dashboard command center", () => {
  test("shows first-value empty state when no core data exists", async ({ page }) => {
    await mountPerfi(page, "/", {});

    await expect(page.getByText("Start with one month of clean data.")).toBeVisible();
    await expect(page.getByText("Step 1")).toBeVisible();
    await expect(page.getByText("Use Forecast and Insights once the first data sync lands.")).toBeVisible();
  });

  test("surfaces command center alerts, goals, and net-worth snapshots with live data", async ({ page }) => {
    await mountPerfi(page, "/", {
      get_cash_flow_summary: {
        income: 7200,
        spending: 6450,
        net: 750,
        prev_income: 7000,
        prev_spending: 6100,
        prev_net: 900,
      },
      get_spending_by_category: [
        { category_id: "housing", category_name: "Housing", color: "#1f6bff", amount: 2400, percentage: 37.2 },
        { category_id: "food", category_name: "Food", color: "#5cc8ff", amount: 900, percentage: 14.0 },
      ],
      get_top_merchants: [
        { merchant: "Landlord", amount: 2400, count: 1 },
        { merchant: "Costco", amount: 560, count: 3 },
      ],
      get_spending_trends: [
        { period: "2026-01", income: 7000, spending: 5900, categories: [] },
        { period: "2026-02", income: 7100, spending: 6200, categories: [] },
        { period: "2026-03", income: 7200, spending: 6450, categories: [] },
      ],
      get_insights: [
        {
          id: "ins-1",
          insight_type: "forecast",
          title: "Cash buffer is getting thin",
          body: "Projected net stays positive, but one weak month could push cash flow negative.",
          severity: "high",
          data_json: null,
          is_read: false,
          is_dismissed: false,
          expires_at: null,
          created_at: "2026-04-01T00:00:00Z",
        },
      ],
      get_goals: [
        {
          goal: {
            id: "goal-1",
            name: "Emergency fund",
            goal_type: "cash",
            target_cents: 1800000,
            current_cents: 960000,
            monthly_contribution_cents: 120000,
            target_date: "2026-12-01",
            priority: 1,
            linked_asset_id: null,
            icon: null,
            color: "#5cc8ff",
            notes: null,
            status: "active",
            completed_at: null,
            created_at: "2026-01-01T00:00:00Z",
          },
          percentage: 53.3,
          projected_completion_date: "2026-12-01",
          on_track: true,
          months_remaining: 8,
        },
      ],
      get_net_worth_summary: {
        total_assets: 158000,
        total_liabilities: 46000,
        net_worth: 112000,
        prev_net_worth: 106500,
        assets_by_type: [],
        liabilities_by_type: [],
      },
      get_cash_flow_forecast: [
        {
          month: "2026-05",
          projected_income: 7200,
          projected_spending: 7600,
          projected_net: -400,
          net_p10: -1300,
          net_p90: 350,
          confidence: 0.71,
        },
      ],
      get_upcoming_bills: [
        {
          merchant: "Rent",
          expected_amount: 2400,
          expected_date: "2026-04-03",
          category: "Housing",
          confidence: 0.94,
        },
      ],
    });

    await expect(page.getByText("Command center", { exact: true })).toBeVisible();
    await expect(page.getByText("Projected cash squeeze next month")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Cash buffer is getting thin" }).first()).toBeVisible();
    await expect(page.getByText("Emergency fund")).toBeVisible();
    await expect(page.getByText("Net worth")).toBeVisible();
  });
});
