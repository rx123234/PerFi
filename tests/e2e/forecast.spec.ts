import { expect, test } from "@playwright/test";
import { mountPerfi } from "./fixtures/mockApi";

test.describe("forecast explainability", () => {
  test("shows breakdown, confidence reasons, and likely range", async ({ page }) => {
    await mountPerfi(page, "/forecast", {
      get_cash_flow_forecast: [
        {
          month: "2026-05",
          projected_income: 8200,
          projected_spending: 6900,
          projected_net: 1300,
          net_p10: -200,
          net_p90: 2400,
          confidence: 0.67,
        },
        {
          month: "2026-06",
          projected_income: 8200,
          projected_spending: 7000,
          projected_net: 1200,
          net_p10: -100,
          net_p90: 2200,
          confidence: 0.64,
        },
      ],
      get_upcoming_bills: [
        {
          merchant: "Rent",
          expected_amount: 2400,
          expected_date: "2026-04-04",
          category: "Housing",
          confidence: 0.95,
        },
        {
          merchant: "Car Loan",
          expected_amount: 425,
          expected_date: "2026-04-11",
          category: "Debt",
          confidence: 0.88,
        },
      ],
      get_seasonal_patterns: [
        { month: 1, month_name: "January", avg_spending: 6200, vs_annual_avg: 0.08 },
        { month: 2, month_name: "February", avg_spending: 5800, vs_annual_avg: -0.04 },
      ],
      get_liabilities: [],
    });

    await expect(page.getByText("Plan around expected cash flow, not guesswork.")).toBeVisible();
    await expect(page.getByText("Next-Month Breakdown")).toBeVisible();
    await expect(page.getByText("Scheduled Bills", { exact: true })).toBeVisible();
    await expect(page.getByText("Flexible Spend", { exact: true })).toBeVisible();
    await expect(page.getByText("Likely range", { exact: true })).toBeVisible();
    await expect(page.getByText("Why confidence looks like this")).toBeVisible();
    await expect(page.getByText("Forecast band")).toBeVisible();
    await expect(page.getByText("The shaded band shows the likely net range from the forecast scenarios.")).toBeVisible();
    await expect(page.getByText("Forecast is estimated, not actual. Use the range, not just the midpoint.")).toBeVisible();
    await expect(page.getByText("Transactions and categories marked excluded from planning are ignored in these projections.")).toBeVisible();
  });
});
