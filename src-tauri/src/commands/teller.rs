use crate::db::DbState;
use crate::models::{Account, TellerConfig, TellerConfigMeta};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;
use uuid::Uuid;

// ── Teller API response types ─────────────────────────────────────────────────

#[derive(Deserialize)]
struct TellerAccount {
    id: String,
    name: String,
    enrollment_id: String,
    institution: TellerInstitution,
    subtype: String,
    #[serde(rename = "type")]
    account_type: String,
}

#[derive(Deserialize)]
struct TellerInstitution {
    name: String,
}

#[derive(Deserialize)]
struct TellerTransaction {
    id: String,
    #[allow(dead_code)]
    account_id: String,
    amount: String,
    date: String,
    description: String,
    details: TellerTransactionDetails,
    status: String,
}

#[derive(Deserialize)]
struct TellerTransactionDetails {
    category: Option<String>,
    counterparty: Option<TellerCounterparty>,
}

#[derive(Deserialize)]
struct TellerCounterparty {
    name: Option<String>,
}

// ── Sync result ───────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct SyncResult {
    pub added: usize,
    pub modified: usize,
    pub removed: usize,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn build_teller_client(cert_path: &str, key_path: &str) -> Result<reqwest::Client, String> {
    let cert_pem = std::fs::read(cert_path)
        .map_err(|e| format!("Failed to read certificate at '{}': {}", cert_path, e))?;
    let key_pem = std::fs::read(key_path)
        .map_err(|e| format!("Failed to read private key at '{}': {}", key_path, e))?;

    let mut identity_pem = cert_pem;
    identity_pem.extend_from_slice(&key_pem);

    let identity = reqwest::Identity::from_pem(&identity_pem)
        .map_err(|e| format!("Failed to load TLS identity: {}", e))?;

    reqwest::Client::builder()
        .identity(identity)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}

fn map_teller_category(category: &Option<String>) -> Option<String> {
    let cat = category.as_deref()?;
    match cat {
        "dining" | "bar" => Some("cat-dining".to_string()),
        "groceries" => Some("cat-groceries".to_string()),
        "fuel" => Some("cat-gas".to_string()),
        "shopping" | "clothing" | "electronics" => Some("cat-shopping".to_string()),
        "software" | "phone" | "service" => Some("cat-subscriptions".to_string()),
        "utilities" => Some("cat-utilities".to_string()),
        "home" | "accommodation" => Some("cat-housing".to_string()),
        "transport" | "travel" => Some("cat-transportation".to_string()),
        "entertainment" | "sport" => Some("cat-entertainment".to_string()),
        "health" | "insurance" => Some("cat-health".to_string()),
        "income" => Some("cat-income".to_string()),
        "investment" | "loan" | "tax" => Some("cat-transfer".to_string()),
        _ => None,
    }
}

fn get_config(conn: &rusqlite::Connection) -> Result<TellerConfig, String> {
    conn.query_row(
        "SELECT app_id, environment, cert_path, key_path FROM teller_config LIMIT 1",
        [],
        |row| {
            Ok(TellerConfig {
                app_id: row.get(0)?,
                environment: row.get(1)?,
                cert_path: row.get(2)?,
                key_path: row.get(3)?,
            })
        },
    )
    .map_err(|_| "Teller not configured. Go to Settings to add your credentials.".to_string())
}

fn sanitize_teller_error(context: &str, raw_error: &str) -> String {
    eprintln!("Teller API error ({}): {}", context, raw_error);
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw_error) {
        if let Some(msg) = parsed.get("message").and_then(|m| m.as_str()) {
            return format!("Teller error: {}", msg);
        }
        if let Some(code) = parsed.get("code").and_then(|c| c.as_str()) {
            return format!("Teller error (code: {}). Check logs for details.", code);
        }
    }
    format!("{} failed. Check logs for details.", context)
}

// ── Unit tests for pure helpers ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_teller_category_known() {
        assert_eq!(map_teller_category(&Some("dining".to_string())), Some("cat-dining".to_string()));
        assert_eq!(map_teller_category(&Some("groceries".to_string())), Some("cat-groceries".to_string()));
        assert_eq!(map_teller_category(&Some("fuel".to_string())), Some("cat-gas".to_string()));
        assert_eq!(map_teller_category(&Some("transport".to_string())), Some("cat-transportation".to_string()));
        assert_eq!(map_teller_category(&Some("income".to_string())), Some("cat-income".to_string()));
    }

    #[test]
    fn test_map_teller_category_unknown_returns_none() {
        assert_eq!(map_teller_category(&Some("unknown_category".to_string())), None);
        assert_eq!(map_teller_category(&None), None);
    }

    #[test]
    fn test_sanitize_teller_error_with_message_field() {
        let json = r#"{"message":"Invalid API key","code":"unauthorized"}"#;
        let result = sanitize_teller_error("Test", json);
        assert!(result.contains("Invalid API key"));
        assert!(!result.contains("unauthorized"));
    }

    #[test]
    fn test_sanitize_teller_error_with_code_only() {
        let json = r#"{"code":"not_found"}"#;
        let result = sanitize_teller_error("Test", json);
        assert!(result.contains("not_found"));
    }

    #[test]
    fn test_sanitize_teller_error_non_json() {
        let result = sanitize_teller_error("Fetch accounts", "500 Internal Server Error");
        assert!(result.contains("Fetch accounts"));
    }
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn save_teller_config(
    state: State<'_, DbState>,
    app_id: String,
    environment: String,
    cert_path: String,
    key_path: String,
) -> Result<(), String> {
    if app_id.trim().is_empty() {
        return Err("App ID is required".to_string());
    }
    match environment.as_str() {
        "sandbox" | "development" | "production" => {}
        _ => return Err(format!("Invalid environment: '{}'", environment)),
    }
    if !Path::new(&cert_path).exists() {
        return Err(format!("Certificate file not found: {}", cert_path));
    }
    if !Path::new(&key_path).exists() {
        return Err(format!("Private key file not found: {}", key_path));
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute_batch("BEGIN TRANSACTION").map_err(|e| e.to_string())?;
    let result = (|| {
        conn.execute("DELETE FROM teller_config", [])?;
        conn.execute(
            "INSERT INTO teller_config (id, app_id, environment, cert_path, key_path)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, app_id, environment, cert_path, key_path],
        )?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn get_teller_config(state: State<'_, DbState>) -> Result<TellerConfigMeta, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT app_id, environment FROM teller_config LIMIT 1",
        [],
        |row| {
            Ok(TellerConfigMeta {
                is_configured: true,
                app_id: row.get(0)?,
                environment: row.get(1)?,
            })
        },
    );
    match result {
        Ok(meta) => Ok(meta),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(TellerConfigMeta {
            is_configured: false,
            environment: "development".to_string(),
            app_id: String::new(),
        }),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn teller_connect_success(
    state: State<'_, DbState>,
    access_token: String,
    enrollment_id: String,
) -> Result<Vec<Account>, String> {
    let config = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        get_config(&conn)?
    };

    let client = build_teller_client(&config.cert_path, &config.key_path)?;

    let resp = client
        .get("https://api.teller.io/accounts")
        .basic_auth(&access_token, Some(""))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch accounts: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(sanitize_teller_error("Fetch accounts", &err_text));
    }

    let teller_accounts: Vec<TellerAccount> = resp.json().await.map_err(|e| e.to_string())?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("BEGIN TRANSACTION").map_err(|e| e.to_string())?;
    let mut created = Vec::new();

    let db_result = (|| -> Result<(), rusqlite::Error> {
        for ta in &teller_accounts {
            let id = Uuid::new_v4().to_string();
            let acc_type = match ta.subtype.as_str() {
                "checking" => "checking",
                "savings" => "savings",
                "credit_card" => "credit_card",
                _ => match ta.account_type.as_str() {
                    "depository" => "checking",
                    "credit" => "credit_card",
                    _ => "other",
                },
            };
            conn.execute(
                "INSERT OR IGNORE INTO accounts
                 (id, name, institution, account_type, teller_account_id, teller_enrollment_id, teller_access_token, source)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'keychain', 'teller')",
                rusqlite::params![id, ta.name, ta.institution.name, acc_type, ta.id, enrollment_id],
            )?;
            if conn.changes() > 0 {
                created.push((
                    id,
                    ta.name.clone(),
                    ta.institution.name.clone(),
                    acc_type.to_string(),
                    ta.id.clone(),
                ));
            }
        }
        Ok(())
    })();

    match db_result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(e.to_string());
        }
    }
    drop(conn);

    // Store access token in keychain keyed by enrollment_id
    let keychain_key = format!("teller-access-token-{}", enrollment_id);
    crate::db::store_secret(&keychain_key, &access_token)?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let accounts = created
        .into_iter()
        .map(|(id, name, institution, account_type, teller_account_id)| Account {
            id,
            name,
            institution: Some(institution),
            account_type,
            teller_account_id: Some(teller_account_id),
            teller_enrollment_id: Some(enrollment_id.clone()),
            mask: None,
            source: "teller".to_string(),
            created_at: now.clone(),
        })
        .collect();

    Ok(accounts)
}

#[tauri::command]
pub async fn sync_transactions(
    state: State<'_, DbState>,
    account_id: String,
) -> Result<SyncResult, String> {
    let (config, teller_account_id, enrollment_id, last_tx_id) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let config = get_config(&conn)?;
        let row: (String, String, Option<String>) = conn
            .query_row(
                "SELECT teller_account_id, teller_enrollment_id, teller_last_tx_id
                 FROM accounts WHERE id = ?1",
                [&account_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| format!("Account not found: {}", e))?;
        (config, row.0, row.1, row.2)
    };

    let keychain_key = format!("teller-access-token-{}", enrollment_id);
    let access_token = crate::db::get_secret(&keychain_key)?
        .ok_or_else(|| "Access token not found. Please re-link the account.".to_string())?;

    let client = build_teller_client(&config.cert_path, &config.key_path)?;

    let mut url = format!(
        "https://api.teller.io/accounts/{}/transactions?count=250",
        teller_account_id
    );
    if let Some(from_id) = &last_tx_id {
        url.push_str(&format!("&from_id={}", from_id));
    }

    let resp = client
        .get(&url)
        .basic_auth(&access_token, Some(""))
        .send()
        .await
        .map_err(|e| format!("Sync failed: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(sanitize_teller_error("Transaction sync", &err_text));
    }

    let transactions: Vec<TellerTransaction> = resp.json().await.map_err(|e| e.to_string())?;

    if transactions.is_empty() {
        return Ok(SyncResult { added: 0, modified: 0, removed: 0 });
    }

    // Teller returns newest-first; index 0 is the most recent transaction
    let newest_tx_id = transactions[0].id.clone();
    let mut added = 0usize;

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("BEGIN TRANSACTION").map_err(|e| e.to_string())?;

    let db_result = (|| -> Result<(), String> {
        for tx in &transactions {
            // Teller amounts: negative = debit (money out), positive = credit (money in)
            let amount: f64 = tx
                .amount
                .parse()
                .map_err(|e| format!("Invalid amount '{}': {}", tx.amount, e))?;
            let amount_cents = (amount * 100.0).round() as i64;
            let category_id = map_teller_category(&tx.details.category);
            let merchant = tx.details.counterparty.as_ref().and_then(|c| c.name.clone());
            let pending = tx.status == "pending";
            let id = Uuid::new_v4().to_string();

            conn.execute(
                "INSERT OR IGNORE INTO transactions
                 (id, account_id, date, amount_cents, description, merchant, teller_tx_id,
                  category_id, source, pending)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'teller', ?9)",
                rusqlite::params![
                    id,
                    account_id,
                    tx.date,
                    amount_cents,
                    tx.description,
                    merchant,
                    tx.id,
                    category_id,
                    pending as i32,
                ],
            )
            .map_err(|e| e.to_string())?;

            if conn.changes() > 0 {
                added += 1;
            }
        }

        conn.execute(
            "UPDATE accounts SET teller_last_tx_id = ?1 WHERE id = ?2",
            rusqlite::params![newest_tx_id, account_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })();

    match db_result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(e);
        }
    }

    Ok(SyncResult { added, modified: 0, removed: 0 })
}

#[tauri::command]
pub async fn sync_all_accounts(
    state: State<'_, DbState>,
) -> Result<Vec<(String, SyncResult)>, String> {
    let account_ids: Vec<String> = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM accounts WHERE source = 'teller'")
            .map_err(|e| e.to_string())?;
        stmt.query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
    };

    let mut results = Vec::new();
    for acc_id in account_ids {
        let result = sync_transactions(state.clone(), acc_id.clone()).await?;
        results.push((acc_id, result));
    }
    Ok(results)
}
