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
  {
    id: "acc-2",
    name: "Brokerage Cash",
    institution: "Manual",
    account_type: "savings",
    teller_account_id: null,
    teller_enrollment_id: null,
    mask: null,
    source: "manual",
    created_at: "2026-01-01T00:00:00Z",
  },
];

test.describe("accounts, settings, and import trust cues", () => {
  test("shows account health metrics and account badges", async ({ page }) => {
    await mountPerfi(page, "/accounts", {
      get_accounts: accounts,
      get_account_balances: [
        {
          account_id: "acc-1",
          account_name: "Chase Checking",
          account_type: "checking",
          institution: "Chase",
          balance: 4825,
          mask: "1234",
        },
      ],
      get_teller_config: {
        is_configured: true,
        environment: "sandbox",
        app_id: "app_123",
      },
    });

    await expect(page.getByText("Account Health")).toBeVisible();
    await expect(page.getByText("Balance Coverage")).toBeVisible();
    await expect(page.getByText("Live Sync", { exact: true })).toBeVisible();
    await expect(page.getByText("Transactions can be refreshed")).toBeVisible();
    await expect(page.getByText("Balances maintained manually")).toBeVisible();
  });

  test("shows settings control-center summary and import readiness", async ({ page }) => {
    await mountPerfi(page, "/settings", {
      get_accounts: accounts,
      get_teller_config: {
        is_configured: true,
        environment: "sandbox",
        app_id: "app_123",
      },
      get_categories: [
        { id: "cat-1", name: "Housing", parent_id: null, color: "#1f6bff", icon: null },
        { id: "cat-2", name: "Food", parent_id: null, color: "#5cc8ff", icon: null },
      ],
      get_category_rules: [
        { id: "rule-1", pattern: "COSTCO", category_id: "cat-2", category_name: "Food", priority: 10 },
      ],
      get_csv_formats: [
        {
          name: "Chase",
          date_column: "Date",
          date_format: "%m/%d/%Y",
          description_column: "Description",
          amount_column: "Amount",
          debit_column: null,
          credit_column: null,
          amount_inverted: false,
        },
      ],
    });

    await expect(page.getByText("Control Center")).toBeVisible();
    await expect(page.getByText("Connection, import, and categorization trust live here.")).toBeVisible();
    await expect(page.getByText("sandbox environment configured")).toBeVisible();
    await expect(page.getByText("CSV import can target any existing account.")).toBeVisible();

    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByText("Manual Import", { exact: true })).toBeVisible();
    await expect(page.getByText("Review the mapping before you import a full statement.")).toBeVisible();

    await page.selectOption("select", "acc-1");
    await page.locator("select").nth(1).selectOption("Chase");
    await expect(page.getByText("Import checklist")).toBeVisible();
    await expect(page.locator("p.font-medium").filter({ hasText: "Chase Checking" })).toBeVisible();
    await expect(page.getByText("Choose a CSV file")).toBeVisible();
  });
});
