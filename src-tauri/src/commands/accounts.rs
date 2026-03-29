use crate::db::DbState;
use crate::models::Account;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_accounts(state: State<'_, DbState>) -> Result<Vec<Account>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, institution, account_type, plaid_account_id, plaid_item_id, mask, source, created_at
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
                plaid_account_id: row.get(4)?,
                plaid_item_id: row.get(5)?,
                mask: row.get(6)?,
                source: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(accounts)
}

#[tauri::command]
pub fn create_account(
    state: State<'_, DbState>,
    name: String,
    institution: Option<String>,
    account_type: String,
) -> Result<Account, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Account name cannot be empty".to_string());
    }
    let account_type = account_type.trim().to_string();
    if account_type.is_empty() {
        return Err("Account type cannot be empty".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO accounts (id, name, institution, account_type, source) VALUES (?1, ?2, ?3, ?4, 'manual')",
        rusqlite::params![id, name, institution, account_type],
    )
    .map_err(|e| e.to_string())?;

    Ok(Account {
        id,
        name,
        institution,
        account_type,
        plaid_account_id: None,
        plaid_item_id: None,
        mask: None,
        source: "manual".to_string(),
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub fn update_account(
    state: State<'_, DbState>,
    id: String,
    name: String,
    institution: Option<String>,
    account_type: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE accounts SET name = ?1, institution = ?2, account_type = ?3 WHERE id = ?4",
        rusqlite::params![name, institution, account_type, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_account(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| e.to_string())?;
    let result = (|| {
        conn.execute("DELETE FROM transactions WHERE account_id = ?1", [&id])?;
        conn.execute("DELETE FROM accounts WHERE id = ?1", [&id])?;
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
