export interface Account {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  plaid_account_id: string | null;
  plaid_item_id: string | null;
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
  created_at: string;
}

export interface CategoryRule {
  id: string;
  pattern: string;
  category_id: string;
  category_name: string | null;
  priority: number;
}

export interface PlaidCredentialsMeta {
  is_configured: boolean;
  environment: string;
  client_id_hint: string;
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
  skip_rows: number;
}

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}
