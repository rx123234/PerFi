import { expect, test } from "@playwright/test";
import { mountPerfi } from "./fixtures/mockApi";

const accounts = [
  {
    id: "acc-1",
    name: "Chase Checking",
    institution: "Chase",
    account_type: "checking",
    teller_account_id: "tel-1",
    teller_enrollment_id: "enr-1",
    mask: "1234",
    source: "teller",
    created_at: "2026-01-01T00:00:00Z",
  },
];

const categories = [
  {
    id: "cat-housing",
    name: "Housing",
    parent_id: null,
    color: "#1f6bff",
    icon: null,
    exclude_from_planning: false,
  },
  {
    id: "cat-reimbursable",
    name: "Reimbursable",
    parent_id: null,
    color: "#f59e0b",
    icon: null,
    exclude_from_planning: true,
  },
];

test.describe("planning exclusions", () => {
  test("transaction rows can be excluded and re-included for planning", async ({ page }) => {
    await mountPerfi(page, "/transactions", {
      get_accounts: accounts,
      get_categories: categories,
      get_transaction_count: 1,
      get_transactions: [
        {
          id: "tx-1",
          account_id: "acc-1",
          date: "2026-03-28",
          amount: -4200,
          description: "Tax Refund Reversal",
          enriched_desc: null,
          category_id: "cat-housing",
          category_name: "Housing",
          merchant: "IRS",
          source: "teller",
          pending: false,
          exclude_from_planning: false,
          created_at: "2026-03-28T12:00:00Z",
        },
      ],
    });

    const row = page.locator("tr", { hasText: "Tax Refund Reversal" });
    await expect(row.getByRole("button", { name: /Exclude .* from planning/i })).toBeVisible();
    await row.getByRole("button", { name: /Exclude .* from planning/i }).click();
    await expect(row.getByText("Excluded from planning")).toBeVisible();
    await expect(row.getByRole("button", { name: /Include .* in planning/i })).toBeVisible();

    await row.getByRole("button", { name: /Include .* in planning/i }).click();
    await expect(row.getByText("Excluded from planning")).toHaveCount(0);
    await expect(row.getByRole("button", { name: /Exclude .* from planning/i })).toBeVisible();
  });

  test("category manager persists planning exclusion toggles", async ({ page }) => {
    await mountPerfi(page, "/settings", {
      get_accounts: accounts,
      get_teller_config: {
        is_configured: true,
        environment: "sandbox",
        app_id: "app_123",
      },
      get_categories: categories,
      get_category_rules: [],
    });

    await page.getByRole("button", { name: "Categories" }).click();
    const categoryCard = page.locator("div.rounded-xl", { hasText: "Housing" }).first();
    await expect(categoryCard.getByRole("button", { name: /Exclude Housing from planning forecasts/i })).toBeVisible();
    await categoryCard.getByRole("button", { name: /Exclude Housing from planning forecasts/i }).click();
    await expect(categoryCard.getByText("Excluded from planning")).toBeVisible();
    await expect(categoryCard.getByRole("button", { name: /Include Housing in planning forecasts/i })).toBeVisible();
  });
});
