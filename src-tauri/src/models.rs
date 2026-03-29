use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub institution: Option<String>,
    pub account_type: String,
    pub plaid_account_id: Option<String>,
    pub plaid_item_id: Option<String>,
    pub mask: Option<String>,
    pub source: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub account_id: String,
    pub date: String,
    pub amount: f64,
    pub description: String,
    pub enriched_desc: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub merchant: Option<String>,
    pub source: String,
    pub pending: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryRule {
    pub id: String,
    pub pattern: String,
    pub category_id: String,
    pub category_name: Option<String>,
    pub priority: i32,
}

/// Internal-only: full credentials for Plaid API calls (never sent to frontend)
#[derive(Debug, Clone)]
pub struct PlaidCredentials {
    #[allow(dead_code)]
    pub id: String,
    pub client_id: String,
    pub secret: String,
    pub environment: String,
}

/// Safe to send to frontend: no secret, masked client_id
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaidCredentialsMeta {
    pub is_configured: bool,
    pub environment: String,
    pub client_id_hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashFlowSummary {
    pub income: f64,
    pub spending: f64,
    pub net: f64,
    pub prev_income: f64,
    pub prev_spending: f64,
    pub prev_net: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySpending {
    pub category_id: String,
    pub category_name: String,
    pub color: String,
    pub amount: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendDataPoint {
    pub period: String,
    pub income: f64,
    pub spending: f64,
    pub categories: Vec<CategoryAmount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryAmount {
    pub category_name: String,
    pub color: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyNode {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyLink {
    pub source: usize,
    pub target: usize,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyData {
    pub nodes: Vec<SankeyNode>,
    pub links: Vec<SankeyLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerchantSpending {
    pub merchant: String,
    pub amount: f64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountBalance {
    pub account_id: String,
    pub account_name: String,
    pub account_type: String,
    pub institution: Option<String>,
    pub balance: f64,
    pub mask: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: usize,
    pub duplicates: usize,
    pub categorized: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionFilter {
    pub account_id: Option<String>,
    pub category_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
