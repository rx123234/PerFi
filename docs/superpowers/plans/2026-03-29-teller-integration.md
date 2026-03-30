# Teller.io Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Plaid integration with Teller.io for automatic bank transaction syncing.

**Architecture:** Delete `plaid.rs` and all Plaid-specific frontend components; add `teller.rs` with mTLS reqwest client, a DB migration renaming Plaid columns to Teller equivalents, and new `TellerConnect`/`TellerSettings` frontend components. The sync result shape, manual account flow, CSV import, and dashboard are all unchanged.

**Tech Stack:** Rust/Tauri 2, reqwest 0.12 (rustls-tls + mTLS identity), rusqlite, React 19, TypeScript, Teller Connect JS widget (CDN), `@tauri-apps/plugin-dialog` (file picker)

---

## File Map

| File | Action |
|------|--------|
| `src-tauri/migrations/002_teller.sql` | **Create** — renames Plaid columns, creates `teller_config` table |
| `src-tauri/src/db.rs` | **Modify** — run migration 002 |
| `src-tauri/src/models.rs` | **Modify** — rename `plaid_*` fields in `Account`; replace `PlaidCredentials`/`PlaidCredentialsMeta` with `TellerConfig`/`TellerConfigMeta` |
| `src-tauri/src/commands/teller.rs` | **Create** — all 5 Teller commands + helpers |
| `src-tauri/src/commands/accounts.rs` | **Modify** — update SQL column names and Account struct field names |
| `src-tauri/src/commands/mod.rs` | **Modify** — replace `pub mod plaid` with `pub mod teller` |
| `src-tauri/src/commands/plaid.rs` | **Delete** |
| `src-tauri/src/lib.rs` | **Modify** — swap Plaid handler registrations for Teller |
| `src/lib/types.ts` | **Modify** — rename `plaid_*` fields in `Account`; replace `PlaidCredentialsMeta` with `TellerConfigMeta` |
| `src/lib/api.ts` | **Modify** — replace Plaid invoke calls with Teller |
| `src/components/Accounts/TellerConnect.tsx` | **Create** — Teller Connect widget button |
| `src/components/Accounts/PlaidLink.tsx` | **Delete** |
| `src/components/Settings/TellerSettings.tsx` | **Create** — app ID + cert/key file picker settings |
| `src/components/Settings/PlaidSettings.tsx` | **Delete** |
| `src/components/Accounts/AccountList.tsx` | **Modify** — swap PlaidLinkButton → TellerConnectButton, update labels |
| `src/App.tsx` | **Modify** — swap PlaidSettings import → TellerSettings |
| `src-tauri/tauri.conf.json` | **Modify** — update CSP for Teller domains |
| `package.json` | **Modify** — remove `react-plaid-link` |

---

## Task 1: DB Migration 002

**Files:**
- Create: `src-tauri/migrations/002_teller.sql`
- Modify: `src-tauri/src/db.rs`

- [ ] **Step 1: Create the migration SQL file**

Create `src-tauri/migrations/002_teller.sql` with this exact content:

```sql
-- Replace plaid_credentials with teller_config
DROP TABLE IF EXISTS plaid_credentials;

CREATE TABLE IF NOT EXISTS teller_config (
    id          TEXT PRIMARY KEY,
    app_id      TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'development',
    cert_path   TEXT NOT NULL,
    key_path    TEXT NOT NULL
);

-- Rename Plaid columns on accounts
ALTER TABLE accounts RENAME COLUMN plaid_account_id   TO teller_account_id;
ALTER TABLE accounts RENAME COLUMN plaid_item_id      TO teller_enrollment_id;
ALTER TABLE accounts RENAME COLUMN plaid_access_token TO teller_access_token;
ALTER TABLE accounts RENAME COLUMN plaid_cursor       TO teller_last_tx_id;

-- Rename Plaid tx id on transactions
ALTER TABLE transactions RENAME COLUMN plaid_tx_id TO teller_tx_id;

-- Unique index for deduplicating accounts on re-enrollment
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_teller_id
    ON accounts(teller_account_id)
    WHERE teller_account_id IS NOT NULL;
```

- [ ] **Step 2: Wire migration 002 into db.rs**

In `src-tauri/src/db.rs`, after the existing migration 001 block (around line 117), add:

```rust
    if !applied.contains(&2) {
        let migration = include_str!("../migrations/002_teller.sql");
        conn.execute_batch(migration)
            .map_err(|e| format!("Failed to run migration 002: {}", e))?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [2],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;
        eprintln!("Applied migration 002_teller.sql");
    }
```

- [ ] **Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: no errors (warnings about unused `keyring` / `get_or_create_db_key` are fine at this stage).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/migrations/002_teller.sql src-tauri/src/db.rs
git commit -m "feat: add DB migration 002 renaming Plaid columns to Teller"
```

---

## Task 2: Update models.rs

**Files:**
- Modify: `src-tauri/src/models.rs`

- [ ] **Step 1: Replace Account struct fields**

In `src-tauri/src/models.rs`, replace the `Account` struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub institution: Option<String>,
    pub account_type: String,
    pub teller_account_id: Option<String>,
    pub teller_enrollment_id: Option<String>,
    pub mask: Option<String>,
    pub source: String,
    pub created_at: String,
}
```

- [ ] **Step 2: Replace Plaid credential structs with Teller equivalents**

Remove the `PlaidCredentials` and `PlaidCredentialsMeta` structs and add these in their place:

```rust
/// Internal-only: full Teller config for API calls (never sent to frontend)
#[derive(Debug, Clone)]
pub struct TellerConfig {
    pub app_id: String,
    pub environment: String,
    pub cert_path: String,
    pub key_path: String,
}

/// Safe to send to frontend — no cert paths, app_id is public
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TellerConfigMeta {
    pub is_configured: bool,
    pub environment: String,
    pub app_id: String,
}
```

Note: `app_id` is returned in full (not masked) because it is a public identifier used by the browser-side Teller Connect widget — it is not a secret.

- [ ] **Step 3: Verify it compiles (errors expected)**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: errors in `commands/plaid.rs` (uses old types) and `commands/accounts.rs` (uses old field names). That's correct — those files get fixed in the next two tasks.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/models.rs
git commit -m "feat: replace Plaid models with TellerConfig/TellerConfigMeta in models.rs"
```

---

## Task 3: Create teller.rs

**Files:**
- Create: `src-tauri/src/commands/teller.rs`

- [ ] **Step 1: Create the file with all helpers and commands**

Create `src-tauri/src/commands/teller.rs` with this full content:

```rust
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
        assert!(!result.contains("unauthorized")); // message takes priority over code
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
```

- [ ] **Step 2: Run the unit tests**

```bash
cd src-tauri && cargo test commands::teller::tests 2>&1
```

Expected output: `test result: ok. 5 passed; 0 failed`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/teller.rs
git commit -m "feat: add teller.rs with all commands, mTLS client, and unit tests"
```

---

## Task 4: Wire Commands, Fix accounts.rs, Delete plaid.rs

**Files:**
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/commands/accounts.rs`
- Modify: `src-tauri/src/lib.rs`
- Delete: `src-tauri/src/commands/plaid.rs`

- [ ] **Step 1: Update commands/mod.rs**

Replace the entire content of `src-tauri/src/commands/mod.rs` with:

```rust
pub mod accounts;
pub mod categories;
pub mod dashboard;
pub mod import;
pub mod teller;
pub mod transactions;
```

- [ ] **Step 2: Update accounts.rs — fix SQL and struct construction**

In `src-tauri/src/commands/accounts.rs`, replace the `get_accounts` function:

```rust
#[tauri::command]
pub fn get_accounts(state: State<'_, DbState>) -> Result<Vec<Account>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, institution, account_type, teller_account_id, teller_enrollment_id, mask, source, created_at
             FROM accounts ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let accounts = stmt
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                institution: row.get(2)?,
                account_type: row.get(3)?,
                teller_account_id: row.get(4)?,
                teller_enrollment_id: row.get(5)?,
                mask: row.get(6)?,
                source: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse account row: {}", e); None }
        })
        .collect();

    Ok(accounts)
}
```

Also replace the `Account { ... }` construction in `create_account` (around line 65):

```rust
    Ok(Account {
        id,
        name,
        institution,
        account_type,
        teller_account_id: None,
        teller_enrollment_id: None,
        mask: None,
        source: "manual".to_string(),
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
```

- [ ] **Step 3: Update lib.rs — swap Plaid handlers for Teller**

In `src-tauri/src/lib.rs`, replace the `// Plaid` block in `invoke_handler!`:

```rust
            // Teller
            commands::teller::save_teller_config,
            commands::teller::get_teller_config,
            commands::teller::teller_connect_success,
            commands::teller::sync_transactions,
            commands::teller::sync_all_accounts,
```

- [ ] **Step 4: Delete plaid.rs**

```bash
rm src-tauri/src/commands/plaid.rs
```

- [ ] **Step 5: Verify full compile**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: clean compile, zero errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/mod.rs src-tauri/src/commands/accounts.rs src-tauri/src/lib.rs
git rm src-tauri/src/commands/plaid.rs
git commit -m "feat: wire Teller commands, remove Plaid, fix accounts.rs column names"
```

---

## Task 5: Update Frontend Types and API

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Update types.ts**

Replace the `Account` interface:

```typescript
export interface Account {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  teller_account_id: string | null;
  teller_enrollment_id: string | null;
  mask: string | null;
  source: string;
  created_at: string;
}
```

Replace `PlaidCredentialsMeta` with `TellerConfigMeta`:

```typescript
export interface TellerConfigMeta {
  is_configured: boolean;
  environment: string;
  app_id: string;
}
```

- [ ] **Step 2: Update api.ts — replace Plaid calls with Teller**

Remove the entire `// Plaid` section and replace it with:

```typescript
// Teller
export const saveTellerConfig = (appId: string, environment: string, certPath: string, keyPath: string) =>
  invoke<void>("save_teller_config", { appId, environment, certPath, keyPath });
export const getTellerConfig = () => invoke<TellerConfigMeta>("get_teller_config");
export const tellerConnectSuccess = (accessToken: string, enrollmentId: string) =>
  invoke<Account[]>("teller_connect_success", { accessToken, enrollmentId });
export const syncTransactions = (accountId: string) =>
  invoke<SyncResult>("sync_transactions", { accountId });
export const syncAllAccounts = () =>
  invoke<[string, SyncResult][]>("sync_all_accounts");
```

Also update the import at the top of `api.ts` — remove `PlaidCredentialsMeta` and add `TellerConfigMeta`:

```typescript
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
  SankeyData,
  SyncResult,
  TellerConfigMeta,
  Transaction,
  TransactionFilter,
  TrendDataPoint,
} from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/api.ts
git commit -m "feat: update frontend types and api.ts for Teller (remove Plaid)"
```

---

## Task 6: Create TellerSettings.tsx

**Files:**
- Create: `src/components/Settings/TellerSettings.tsx`
- Delete: `src/components/Settings/PlaidSettings.tsx`

- [ ] **Step 1: Create TellerSettings.tsx**

Create `src/components/Settings/TellerSettings.tsx`:

```tsx
import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { CheckCircle, AlertCircle, ShieldCheck, FolderOpen } from "lucide-react";

export default function TellerSettings() {
  const [appId, setAppId] = useState("");
  const [environment, setEnvironment] = useState("development");
  const [certPath, setCertPath] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [configuredEnv, setConfiguredEnv] = useState("");

  useEffect(() => {
    api.getTellerConfig().then((meta) => {
      setIsConfigured(meta.is_configured);
      setEnvironment(meta.environment);
      setConfiguredEnv(meta.environment);
      if (meta.app_id) setAppId(meta.app_id);
    });
  }, []);

  const browseCert = async () => {
    const path = await open({ multiple: false, title: "Select Certificate File" });
    if (typeof path === "string") setCertPath(path);
  };

  const browseKey = async () => {
    const path = await open({ multiple: false, title: "Select Private Key File" });
    if (typeof path === "string") setKeyPath(path);
  };

  const handleSave = async () => {
    if (!appId.trim()) { setError("App ID is required"); return; }
    if (!certPath.trim()) { setError("Certificate file is required"); return; }
    if (!keyPath.trim()) { setError("Private key file is required"); return; }
    try {
      setError(null);
      await api.saveTellerConfig(appId, environment, certPath, keyPath);
      setSaved(true);
      setIsConfigured(true);
      setConfiguredEnv(environment);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Teller API Configuration</CardTitle>
          <CardDescription>
            Sign up at teller.io to get your Application ID and download your certificate files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConfigured && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm">
              <ShieldCheck className="h-4 w-4" />
              Teller configured (Environment: {configuredEnv})
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Application ID</label>
            <Input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="app_..."
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="sandbox">Sandbox (test data)</option>
              <option value="development">Development (real banks)</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Certificate File</label>
            <div className="flex gap-2">
              <Input
                value={certPath}
                onChange={(e) => setCertPath(e.target.value)}
                placeholder="Path to certificate.pem"
                readOnly
              />
              <Button variant="outline" size="sm" onClick={browseCert}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Private Key File</label>
            <div className="flex gap-2">
              <Input
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                placeholder="Path to private_key.pem"
                readOnly
              />
              <Button variant="outline" size="sm" onClick={browseKey}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Configuration saved successfully
            </div>
          )}

          <Button onClick={handleSave}>
            {isConfigured ? "Update Configuration" : "Save Configuration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Delete PlaidSettings.tsx**

```bash
rm src/components/Settings/PlaidSettings.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings/TellerSettings.tsx
git rm src/components/Settings/PlaidSettings.tsx
git commit -m "feat: add TellerSettings component with cert file picker, remove PlaidSettings"
```

---

## Task 7: Create TellerConnect.tsx

**Files:**
- Create: `src/components/Accounts/TellerConnect.tsx`
- Delete: `src/components/Accounts/PlaidLink.tsx`

- [ ] **Step 1: Create TellerConnect.tsx**

Create `src/components/Accounts/TellerConnect.tsx`:

```tsx
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { Link } from "lucide-react";

// Teller Connect JS widget type declarations
declare global {
  interface Window {
    TellerConnect: {
      setup: (config: {
        appId: string;
        environment: string;
        onSuccess: (enrollment: TellerEnrollment) => void;
        onExit: () => void;
      }) => { open: () => void };
    };
  }
}

interface TellerEnrollment {
  accessToken: string;
  enrollment: { id: string; institution: { name: string } };
  user: { id: string };
}

interface Props {
  onSuccess: () => void;
}

function loadTellerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TellerConnect) { resolve(); return; }
    const existing = document.getElementById("teller-connect-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "teller-connect-script";
    script.src = "https://cdn.teller.io/connect/connect.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Teller Connect script"));
    document.head.appendChild(script);
  });
}

export default function TellerConnectButton({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const config = await api.getTellerConfig();
      if (!config.is_configured) {
        alert("Teller is not configured. Go to Settings to add your Application ID and certificates.");
        return;
      }

      await loadTellerScript();

      const tellerConnect = window.TellerConnect.setup({
        appId: config.app_id,
        environment: config.environment,
        onSuccess: async (enrollment: TellerEnrollment) => {
          try {
            const accounts = await api.tellerConnectSuccess(
              enrollment.accessToken,
              enrollment.enrollment.id
            );
            alert(`Linked ${accounts.length} account(s) successfully!`);
            onSuccess();
          } catch (err) {
            alert(`Failed to link account: ${err}`);
          }
        },
        onExit: () => setLoading(false),
      });

      tellerConnect.open();
    } catch (err) {
      alert(`Failed to open Teller Connect: ${err}`);
      setLoading(false);
    }
  }, [onSuccess]);

  return (
    <Button onClick={handleClick} disabled={loading} size="sm">
      <Link className="h-4 w-4" />
      {loading ? "Connecting..." : "Link Account"}
    </Button>
  );
}
```

- [ ] **Step 2: Delete PlaidLink.tsx**

```bash
rm src/components/Accounts/PlaidLink.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Accounts/TellerConnect.tsx
git rm src/components/Accounts/PlaidLink.tsx
git commit -m "feat: add TellerConnect widget button, remove PlaidLink"
```

---

## Task 8: Update AccountList.tsx and App.tsx

**Files:**
- Modify: `src/components/Accounts/AccountList.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update AccountList.tsx**

Make three changes in `src/components/Accounts/AccountList.tsx`:

**Change 1** — Replace import at line 9:
```tsx
import TellerConnectButton from "./TellerConnect";
```

**Change 2** — Replace `<PlaidLinkButton onSuccess={loadAccounts} />` with:
```tsx
<TellerConnectButton onSuccess={loadAccounts} />
```

**Change 3** — Replace the `<Badge>` block that checks `acc.source === "plaid"`:
```tsx
<Badge variant={acc.source === "teller" ? "default" : "secondary"}>
  {acc.source === "teller" ? (
    <><Link className="h-3 w-3 mr-1" /> Teller</>
  ) : (
    "Manual"
  )}
</Badge>
```

**Change 4** — Replace the sync button condition `acc.source === "plaid"` with `acc.source === "teller"`:
```tsx
{acc.source === "teller" && (
```

**Change 5** — Replace the empty state text:
```tsx
No accounts yet. Link a bank via Teller or add a manual account.
```

- [ ] **Step 2: Update App.tsx**

Replace the `PlaidSettings` import and route in `src/App.tsx`:

```tsx
import TellerSettings from "./components/Settings/TellerSettings";
```

And the route:
```tsx
<Route path="/settings" element={<TellerSettings />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Accounts/AccountList.tsx src/App.tsx
git commit -m "feat: update AccountList and App.tsx to use Teller components"
```

---

## Task 9: Update CSP and Remove react-plaid-link

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `package.json`

- [ ] **Step 1: Update CSP in tauri.conf.json**

Replace the `csp` value in `src-tauri/tauri.conf.json`:

```json
"csp": "default-src 'self'; script-src 'self' https://cdn.teller.io; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.teller.io; frame-src https://connect.teller.io"
```

- [ ] **Step 2: Remove react-plaid-link from package.json**

```bash
pnpm remove react-plaid-link
```

Expected output: package removed, `pnpm-lock.yaml` updated.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json package.json pnpm-lock.yaml
git commit -m "feat: update CSP for Teller domains, remove react-plaid-link"
```

---

## Task 10: Full Build and Smoke Test

- [ ] **Step 1: Run Rust tests**

```bash
cd src-tauri && cargo test 2>&1
```

Expected: `test result: ok. 5 passed; 0 failed`

- [ ] **Step 2: Run the full dev build**

```bash
cd .. && pnpm tauri dev 2>&1
```

Expected: Vite compiles, Cargo compiles, app window opens. No TypeScript errors in the Vite output.

- [ ] **Step 3: Smoke test Settings**

In the running app:
1. Navigate to Settings
2. Enter your Teller Application ID
3. Select environment (Development for real banks, Sandbox for test)
4. Use the browse buttons to select your `certificate.pem` and `private_key.pem` files
5. Click Save — should show green "Configuration saved" confirmation

- [ ] **Step 4: Smoke test Link Account**

1. Navigate to Accounts
2. Click "Link Account"
3. Teller Connect widget should appear
4. Complete bank authentication
5. Confirm accounts appear in the list with "Teller" badge

- [ ] **Step 5: Smoke test Sync**

1. Click "Sync" on a linked account
2. Confirm transactions appear in the Transactions tab

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Teller.io integration replacing Plaid"
```
