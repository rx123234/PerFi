import { invoke } from "@tauri-apps/api/core";
import type {
  Account,
  AccountBalance,
  CashFlowSummary,
  Category,
  CategoryRule,
  CategorySpending,
  CsvFormat,
  ImportResult,
  MerchantSpending,
  PlaidCredentialsMeta,
  SankeyData,
  SyncResult,
  Transaction,
  TransactionFilter,
  TrendDataPoint,
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

// Plaid
export const savePlaidCredentials = (clientId: string, secret: string, environment: string) =>
  invoke<void>("save_plaid_credentials", { clientId, secret, environment });
export const getPlaidCredentials = () => invoke<PlaidCredentialsMeta>("get_plaid_credentials");
export const createLinkToken = () => invoke<string>("create_link_token");
export const exchangePublicToken = (publicToken: string) =>
  invoke<Account[]>("exchange_public_token", { publicToken });
export const syncTransactions = (accountId: string) =>
  invoke<SyncResult>("sync_transactions", { accountId });
export const syncAllAccounts = () =>
  invoke<[string, SyncResult][]>("sync_all_accounts");

// Import
export const getCsvFormats = () => invoke<CsvFormat[]>("get_csv_formats");
export const previewCsv = (filePath: string, formatName: string, accountId: string) =>
  invoke<Record<string, unknown>[]>("preview_csv", { filePath, formatName, accountId });
export const importCsv = (filePath: string, accountId: string, formatName: string) =>
  invoke<ImportResult>("import_csv", { filePath, accountId, formatName });
export const recategorizeTransactions = () => invoke<number>("recategorize_transactions");
