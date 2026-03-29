use crate::db::DbState;
use crate::models::PlaidCredentials;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Serialize)]
struct PlaidLinkTokenRequest {
    client_id: String,
    secret: String,
    user: PlaidUser,
    client_name: String,
    products: Vec<String>,
    country_codes: Vec<String>,
    language: String,
}

#[derive(Serialize)]
struct PlaidUser {
    client_user_id: String,
}

#[derive(Deserialize)]
struct PlaidLinkTokenResponse {
    link_token: String,
}

#[derive(Serialize)]
struct PlaidExchangeRequest {
    client_id: String,
    secret: String,
    public_token: String,
}

#[derive(Deserialize)]
struct PlaidExchangeResponse {
    access_token: String,
    item_id: String,
}

#[derive(Serialize)]
struct PlaidAccountsRequest {
    client_id: String,
    secret: String,
    access_token: String,
}

#[derive(Deserialize)]
struct PlaidAccountsResponse {
    accounts: Vec<PlaidAccount>,
}

#[derive(Deserialize)]
struct PlaidAccount {
    account_id: String,
    name: String,
    #[serde(rename = "type")]
    account_type: String,
    subtype: Option<String>,
    mask: Option<String>,
}

#[derive(Serialize)]
struct PlaidSyncRequest {
    client_id: String,
    secret: String,
    access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    cursor: Option<String>,
    count: i32,
}

#[derive(Deserialize)]
struct PlaidSyncResponse {
    added: Vec<PlaidTransaction>,
    modified: Vec<PlaidTransaction>,
    removed: Vec<PlaidRemovedTransaction>,
    next_cursor: String,
    has_more: bool,
}

#[derive(Deserialize)]
struct PlaidTransaction {
    transaction_id: String,
    #[allow(dead_code)]
    account_id: String,
    amount: f64,
    date: String,
    name: String,
    merchant_name: Option<String>,
    pending: bool,
    personal_finance_category: Option<PlaidCategory>,
}

#[derive(Deserialize)]
struct PlaidCategory {
    primary: String,
    #[allow(dead_code)]
    detailed: String,
}

#[derive(Deserialize)]
struct PlaidRemovedTransaction {
    transaction_id: String,
}

fn get_plaid_base_url(environment: &str) -> &str {
    match environment {
        "sandbox" => "https://sandbox.plaid.com",
        "production" => "https://production.plaid.com",
        _ => "https://development.plaid.com",
    }
}

fn get_credentials(conn: &rusqlite::Connection) -> Result<PlaidCredentials, String> {
    conn.query_row(
        "SELECT id, client_id, secret, environment FROM plaid_credentials LIMIT 1",
        [],
        |row| {
            Ok(PlaidCredentials {
                id: row.get(0)?,
                client_id: row.get(1)?,
                secret: row.get(2)?,
                environment: row.get(3)?,
            })
        },
    )
    .map_err(|_| "Plaid credentials not configured. Go to Settings to add them.".to_string())
}

fn map_plaid_category(category: &Option<PlaidCategory>) -> Option<String> {
    let cat = category.as_ref()?;
    match cat.primary.as_str() {
        "FOOD_AND_DRINK" => Some("cat-dining".to_string()),
        "GENERAL_MERCHANDISE" => Some("cat-shopping".to_string()),
        "GROCERIES" => Some("cat-groceries".to_string()),
        "TRANSPORTATION" => Some("cat-transportation".to_string()),
        "TRAVEL" => Some("cat-transportation".to_string()),
        "ENTERTAINMENT" => Some("cat-entertainment".to_string()),
        "RENT_AND_UTILITIES" => Some("cat-utilities".to_string()),
        "MEDICAL" => Some("cat-health".to_string()),
        "INCOME" => Some("cat-income".to_string()),
        "TRANSFER_IN" | "TRANSFER_OUT" => Some("cat-transfer".to_string()),
        "LOAN_PAYMENTS" => Some("cat-housing".to_string()),
        _ => None,
    }
}

#[tauri::command]
pub fn save_plaid_credentials(
    state: State<'_, DbState>,
    client_id: String,
    secret: String,
    environment: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute("DELETE FROM plaid_credentials", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO plaid_credentials (id, client_id, secret, environment) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, client_id, secret, environment],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_plaid_credentials(state: State<'_, DbState>) -> Result<Option<PlaidCredentials>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, client_id, secret, environment FROM plaid_credentials LIMIT 1",
        [],
        |row| {
            Ok(PlaidCredentials {
                id: row.get(0)?,
                client_id: row.get(1)?,
                secret: row.get(2)?,
                environment: row.get(3)?,
            })
        },
    );

    match result {
        Ok(creds) => Ok(Some(creds)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn create_link_token(state: State<'_, DbState>) -> Result<String, String> {
    let creds = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        get_credentials(&conn)?
    };

    let base_url = get_plaid_base_url(&creds.environment);
    let client = reqwest::Client::new();

    let body = PlaidLinkTokenRequest {
        client_id: creds.client_id,
        secret: creds.secret,
        user: PlaidUser {
            client_user_id: "perfi-user".to_string(),
        },
        client_name: "PerFi".to_string(),
        products: vec!["transactions".to_string()],
        country_codes: vec!["US".to_string()],
        language: "en".to_string(),
    };

    let resp = client
        .post(format!("{}/link/token/create", base_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to create link token: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Plaid API error: {}", err_text));
    }

    let result: PlaidLinkTokenResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(result.link_token)
}

#[tauri::command]
pub async fn exchange_public_token(
    state: State<'_, DbState>,
    public_token: String,
) -> Result<Vec<crate::models::Account>, String> {
    let creds = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        get_credentials(&conn)?
    };

    let base_url = get_plaid_base_url(&creds.environment);
    let client = reqwest::Client::new();

    // Exchange public token for access token
    let exchange_body = PlaidExchangeRequest {
        client_id: creds.client_id.clone(),
        secret: creds.secret.clone(),
        public_token,
    };

    let resp = client
        .post(format!("{}/item/public_token/exchange", base_url))
        .json(&exchange_body)
        .send()
        .await
        .map_err(|e| format!("Failed to exchange token: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Plaid API error: {}", err_text));
    }

    let exchange_result: PlaidExchangeResponse = resp.json().await.map_err(|e| e.to_string())?;

    // Get accounts for this item
    let accounts_body = PlaidAccountsRequest {
        client_id: creds.client_id,
        secret: creds.secret,
        access_token: exchange_result.access_token.clone(),
    };

    let resp = client
        .post(format!("{}/accounts/get", base_url))
        .json(&accounts_body)
        .send()
        .await
        .map_err(|e| format!("Failed to get accounts: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Plaid API error: {}", err_text));
    }

    let accounts_result: PlaidAccountsResponse = resp.json().await.map_err(|e| e.to_string())?;

    // Store accounts in DB
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut created_accounts = Vec::new();

    for plaid_acc in accounts_result.accounts {
        let id = Uuid::new_v4().to_string();
        let acc_type = match plaid_acc.subtype.as_deref() {
            Some("checking") => "checking",
            Some("savings") => "savings",
            Some("credit card") => "credit_card",
            _ => match plaid_acc.account_type.as_str() {
                "depository" => "checking",
                "credit" => "credit_card",
                _ => "other",
            },
        };

        conn.execute(
            "INSERT INTO accounts (id, name, account_type, plaid_account_id, plaid_access_token, plaid_item_id, mask, source)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'plaid')",
            rusqlite::params![
                id,
                plaid_acc.name,
                acc_type,
                plaid_acc.account_id,
                exchange_result.access_token,
                exchange_result.item_id,
                plaid_acc.mask,
            ],
        )
        .map_err(|e| e.to_string())?;

        created_accounts.push(crate::models::Account {
            id,
            name: plaid_acc.name,
            institution: None,
            account_type: acc_type.to_string(),
            plaid_account_id: Some(plaid_acc.account_id),
            plaid_item_id: Some(exchange_result.item_id.clone()),
            mask: plaid_acc.mask,
            source: "plaid".to_string(),
            created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        });
    }

    Ok(created_accounts)
}

#[derive(Serialize, Deserialize)]
pub struct SyncResult {
    pub added: usize,
    pub modified: usize,
    pub removed: usize,
}

#[tauri::command]
pub async fn sync_transactions(
    state: State<'_, DbState>,
    account_id: String,
) -> Result<SyncResult, String> {
    let (creds, access_token, cursor) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let creds = get_credentials(&conn)?;
        let (access_token, cursor): (String, Option<String>) = conn
            .query_row(
                "SELECT plaid_access_token, plaid_cursor FROM accounts WHERE id = ?1",
                [&account_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| format!("Account not found: {}", e))?;
        (creds, access_token, cursor)
    };

    let base_url = get_plaid_base_url(&creds.environment);
    let client = reqwest::Client::new();

    let mut total_added = 0usize;
    let mut total_modified = 0usize;
    let mut total_removed = 0usize;
    let mut current_cursor = cursor;

    loop {
        let body = PlaidSyncRequest {
            client_id: creds.client_id.clone(),
            secret: creds.secret.clone(),
            access_token: access_token.clone(),
            cursor: current_cursor.clone(),
            count: 500,
        };

        let resp = client
            .post(format!("{}/transactions/sync", base_url))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Sync failed: {}", e))?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(format!("Plaid sync error: {}", err_text));
        }

        let sync_result: PlaidSyncResponse = resp.json().await.map_err(|e| e.to_string())?;

        {
            let conn = state.0.lock().map_err(|e| e.to_string())?;

            // Process added transactions
            for tx in &sync_result.added {
                let id = Uuid::new_v4().to_string();
                // Plaid amounts: positive = money leaving account (debit), negative = money entering (credit)
                // We want: negative = debit, positive = credit
                let amount = -tx.amount;
                let category_id = map_plaid_category(&tx.personal_finance_category);

                conn.execute(
                    "INSERT OR IGNORE INTO transactions (id, account_id, date, amount, description, merchant, plaid_tx_id, category_id, source, pending)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'plaid', ?9)",
                    rusqlite::params![
                        id,
                        account_id,
                        tx.date,
                        amount,
                        tx.name,
                        tx.merchant_name,
                        tx.transaction_id,
                        category_id,
                        tx.pending as i32,
                    ],
                )
                .map_err(|e| e.to_string())?;
                total_added += 1;
            }

            // Process modified transactions
            for tx in &sync_result.modified {
                let amount = -tx.amount;
                let category_id = map_plaid_category(&tx.personal_finance_category);

                conn.execute(
                    "UPDATE transactions SET date = ?1, amount = ?2, description = ?3, merchant = ?4, category_id = COALESCE(category_id, ?5), pending = ?6
                     WHERE plaid_tx_id = ?7",
                    rusqlite::params![
                        tx.date,
                        amount,
                        tx.name,
                        tx.merchant_name,
                        category_id,
                        tx.pending as i32,
                        tx.transaction_id,
                    ],
                )
                .map_err(|e| e.to_string())?;
                total_modified += 1;
            }

            // Process removed transactions
            for tx in &sync_result.removed {
                conn.execute(
                    "DELETE FROM transactions WHERE plaid_tx_id = ?1",
                    [&tx.transaction_id],
                )
                .map_err(|e| e.to_string())?;
                total_removed += 1;
            }

            // Update cursor
            conn.execute(
                "UPDATE accounts SET plaid_cursor = ?1 WHERE id = ?2",
                rusqlite::params![sync_result.next_cursor, account_id],
            )
            .map_err(|e| e.to_string())?;
        }

        current_cursor = Some(sync_result.next_cursor);

        if !sync_result.has_more {
            break;
        }
    }

    Ok(SyncResult {
        added: total_added,
        modified: total_modified,
        removed: total_removed,
    })
}

#[tauri::command]
pub async fn sync_all_accounts(state: State<'_, DbState>) -> Result<Vec<(String, SyncResult)>, String> {
    let account_ids: Vec<String> = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM accounts WHERE source = 'plaid' AND plaid_access_token IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| r.ok()).collect()
    };

    let mut results = Vec::new();
    for acc_id in account_ids {
        let result = sync_transactions(state.clone(), acc_id.clone()).await?;
        results.push((acc_id, result));
    }

    Ok(results)
}
