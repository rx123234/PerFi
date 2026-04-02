use crate::db::DbState;
use crate::models::*;
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

// ─────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────

/// Build virtual Asset entries from the accounts table (checking, savings, credit cards).
/// Uses the Teller-reported balance if available, otherwise falls back to transaction sum.
fn get_bank_account_assets(conn: &rusqlite::Connection) -> Result<Vec<Asset>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.name, a.institution, a.account_type, a.created_at,
                    COALESCE(SUM(t.amount_cents), 0) as tx_balance,
                    a.balance_cents
             FROM accounts a
             LEFT JOIN transactions t ON t.account_id = a.id
             GROUP BY a.id
             ORDER BY a.name",
        )
        .map_err(|e| e.to_string())?;

    let assets = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let institution: Option<String> = row.get(2)?;
            let account_type: String = row.get(3)?;
            let created_at: String = row.get(4)?;
            let tx_balance_cents: i64 = row.get(5)?;
            let api_balance_cents: Option<i64> = row.get(6)?;
            // Prefer API-reported balance, fall back to transaction sum
            let balance_cents = api_balance_cents.unwrap_or(tx_balance_cents);

            let asset_type = match account_type.as_str() {
                "credit_card" => "Credit Card",
                _ => "Cash",
            };

            Ok(Asset {
                id: format!("acct-{}", id),
                name,
                asset_type: asset_type.to_string(),
                institution,
                current_value_cents: balance_cents,
                ticker: None,
                shares: None,
                cost_basis_cents: None,
                purchase_price_cents: None,
                purchase_date: None,
                tax_treatment: Some("taxable".to_string()),
                contribution_ytd_cents: 0,
                contribution_limit_cents: None,
                notes: Some(format!("Bank account ({})", account_type)),
                is_manual: false,
                linked_account_id: Some(id),
                updated_at: created_at.clone(),
                created_at,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to build bank account asset: {}", e);
                None
            }
        })
        .collect();

    Ok(assets)
}

#[tauri::command]
pub fn get_assets(state: State<'_, DbState>) -> Result<Vec<Asset>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, asset_type, institution, current_value_cents, ticker, shares,
                    cost_basis_cents, purchase_price_cents, purchase_date, tax_treatment,
                    contribution_ytd_cents, contribution_limit_cents, notes, is_manual,
                    linked_account_id, updated_at, created_at
             FROM assets
             ORDER BY asset_type, name",
        )
        .map_err(|e| e.to_string())?;

    let mut assets: Vec<Asset> = stmt
        .query_map([], |row| {
            Ok(Asset {
                id: row.get(0)?,
                name: row.get(1)?,
                asset_type: row.get(2)?,
                institution: row.get(3)?,
                current_value_cents: row.get(4)?,
                ticker: row.get(5)?,
                shares: row.get(6)?,
                cost_basis_cents: row.get(7)?,
                purchase_price_cents: row.get(8)?,
                purchase_date: row.get(9)?,
                tax_treatment: row.get(10)?,
                contribution_ytd_cents: row.get::<_, Option<i64>>(11)?.unwrap_or(0),
                contribution_limit_cents: row.get(12)?,
                notes: row.get(13)?,
                is_manual: row.get::<_, i64>(14)? != 0,
                linked_account_id: row.get(15)?,
                updated_at: row.get(16)?,
                created_at: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse asset row: {}", e);
                None
            }
        })
        .collect();

    // Append bank accounts as virtual assets
    let bank_assets = get_bank_account_assets(&conn)?;
    assets.extend(bank_assets);

    Ok(assets)
}

#[tauri::command]
pub fn create_asset(
    state: State<'_, DbState>,
    name: String,
    asset_type: String,
    institution: Option<String>,
    current_value_cents: i64,
    ticker: Option<String>,
    shares: Option<f64>,
    cost_basis_cents: Option<i64>,
    purchase_price_cents: Option<i64>,
    purchase_date: Option<String>,
    tax_treatment: Option<String>,
    contribution_ytd_cents: Option<i64>,
    contribution_limit_cents: Option<i64>,
    notes: Option<String>,
    linked_account_id: Option<String>,
) -> Result<Asset, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Asset name cannot be empty".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let ytd = contribution_ytd_cents.unwrap_or(0);

    conn.execute(
        "INSERT INTO assets (
            id, name, asset_type, institution, current_value_cents, ticker, shares,
            cost_basis_cents, purchase_price_cents, purchase_date, tax_treatment,
            contribution_ytd_cents, contribution_limit_cents, notes, is_manual, linked_account_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 1, ?15)",
        rusqlite::params![
            id, name, asset_type, institution, current_value_cents, ticker, shares,
            cost_basis_cents, purchase_price_cents, purchase_date, tax_treatment,
            ytd, contribution_limit_cents, notes, linked_account_id
        ],
    )
    .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    Ok(Asset {
        id,
        name,
        asset_type,
        institution,
        current_value_cents,
        ticker,
        shares,
        cost_basis_cents,
        purchase_price_cents,
        purchase_date,
        tax_treatment,
        contribution_ytd_cents: ytd,
        contribution_limit_cents,
        notes,
        is_manual: true,
        linked_account_id,
        updated_at: now.clone(),
        created_at: now,
    })
}

#[tauri::command]
pub fn update_asset(
    state: State<'_, DbState>,
    id: String,
    name: String,
    asset_type: String,
    institution: Option<String>,
    current_value_cents: i64,
    ticker: Option<String>,
    shares: Option<f64>,
    cost_basis_cents: Option<i64>,
    purchase_price_cents: Option<i64>,
    purchase_date: Option<String>,
    tax_treatment: Option<String>,
    contribution_ytd_cents: Option<i64>,
    contribution_limit_cents: Option<i64>,
    notes: Option<String>,
    linked_account_id: Option<String>,
) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Asset name cannot be empty".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute(
            "UPDATE assets SET
                name = ?1,
                asset_type = ?2,
                institution = ?3,
                current_value_cents = ?4,
                ticker = ?5,
                shares = ?6,
                cost_basis_cents = ?7,
                purchase_price_cents = ?8,
                purchase_date = ?9,
                tax_treatment = ?10,
                contribution_ytd_cents = ?11,
                contribution_limit_cents = ?12,
                notes = ?13,
                linked_account_id = ?14,
                updated_at = datetime('now')
             WHERE id = ?15",
            rusqlite::params![
                name, asset_type, institution, current_value_cents, ticker, shares,
                cost_basis_cents, purchase_price_cents, purchase_date, tax_treatment,
                contribution_ytd_cents, contribution_limit_cents, notes, linked_account_id, id
            ],
        )
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        return Err(format!("Asset not found: {}", id));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_asset(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM assets WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Asset not found: {}", id));
    }
    Ok(())
}

// ─────────────────────────────────────────────
// Liabilities
// ─────────────────────────────────────────────

#[tauri::command]
pub fn get_liabilities(state: State<'_, DbState>) -> Result<Vec<Liability>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, liability_type, institution, current_balance_cents,
                    original_balance_cents, interest_rate, minimum_payment_cents,
                    monthly_payment_cents, payment_day, maturity_date, linked_account_id,
                    notes, updated_at, created_at
             FROM liabilities
             ORDER BY liability_type, name",
        )
        .map_err(|e| e.to_string())?;

    let liabilities = stmt
        .query_map([], |row| {
            Ok(Liability {
                id: row.get(0)?,
                name: row.get(1)?,
                liability_type: row.get(2)?,
                institution: row.get(3)?,
                current_balance_cents: row.get(4)?,
                original_balance_cents: row.get(5)?,
                interest_rate: row.get(6)?,
                minimum_payment_cents: row.get(7)?,
                monthly_payment_cents: row.get(8)?,
                payment_day: row.get(9)?,
                maturity_date: row.get(10)?,
                linked_account_id: row.get(11)?,
                notes: row.get(12)?,
                updated_at: row.get(13)?,
                created_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse liability row: {}", e);
                None
            }
        })
        .collect();

    Ok(liabilities)
}

#[tauri::command]
pub fn create_liability(
    state: State<'_, DbState>,
    name: String,
    liability_type: String,
    institution: Option<String>,
    current_balance_cents: i64,
    original_balance_cents: Option<i64>,
    interest_rate: Option<f64>,
    minimum_payment_cents: Option<i64>,
    monthly_payment_cents: Option<i64>,
    payment_day: Option<i32>,
    maturity_date: Option<String>,
    linked_account_id: Option<String>,
    notes: Option<String>,
) -> Result<Liability, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Liability name cannot be empty".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO liabilities (
            id, name, liability_type, institution, current_balance_cents, original_balance_cents,
            interest_rate, minimum_payment_cents, monthly_payment_cents, payment_day,
            maturity_date, linked_account_id, notes
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            id, name, liability_type, institution, current_balance_cents, original_balance_cents,
            interest_rate, minimum_payment_cents, monthly_payment_cents, payment_day,
            maturity_date, linked_account_id, notes
        ],
    )
    .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    Ok(Liability {
        id,
        name,
        liability_type,
        institution,
        current_balance_cents,
        original_balance_cents,
        interest_rate,
        minimum_payment_cents,
        monthly_payment_cents,
        payment_day,
        maturity_date,
        linked_account_id,
        notes,
        updated_at: now.clone(),
        created_at: now,
    })
}

#[tauri::command]
pub fn update_liability(
    state: State<'_, DbState>,
    id: String,
    name: String,
    liability_type: String,
    institution: Option<String>,
    current_balance_cents: i64,
    original_balance_cents: Option<i64>,
    interest_rate: Option<f64>,
    minimum_payment_cents: Option<i64>,
    monthly_payment_cents: Option<i64>,
    payment_day: Option<i32>,
    maturity_date: Option<String>,
    linked_account_id: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Liability name cannot be empty".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute(
            "UPDATE liabilities SET
                name = ?1,
                liability_type = ?2,
                institution = ?3,
                current_balance_cents = ?4,
                original_balance_cents = ?5,
                interest_rate = ?6,
                minimum_payment_cents = ?7,
                monthly_payment_cents = ?8,
                payment_day = ?9,
                maturity_date = ?10,
                linked_account_id = ?11,
                notes = ?12,
                updated_at = datetime('now')
             WHERE id = ?13",
            rusqlite::params![
                name, liability_type, institution, current_balance_cents,
                original_balance_cents, interest_rate, minimum_payment_cents, monthly_payment_cents,
                payment_day, maturity_date, linked_account_id, notes, id
            ],
        )
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        return Err(format!("Liability not found: {}", id));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_liability(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM liabilities WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Liability not found: {}", id));
    }
    Ok(())
}

// ─────────────────────────────────────────────
// Net Worth Summary & History
// ─────────────────────────────────────────────

#[tauri::command]
pub fn get_net_worth_summary(state: State<'_, DbState>) -> Result<NetWorthSummary, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Assets by type
    let mut stmt = conn
        .prepare(
            "SELECT asset_type, SUM(current_value_cents), COUNT(*)
             FROM assets
             GROUP BY asset_type",
        )
        .map_err(|e| e.to_string())?;

    let mut assets_by_type: Vec<AssetTypeTotal> = stmt
        .query_map([], |row| {
            Ok(AssetTypeTotal {
                asset_type: row.get(0)?,
                total: row.get::<_, i64>(1)? as f64 / 100.0,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse asset type row: {}", e);
                None
            }
        })
        .collect();

    let mut total_assets_cents: i64 = assets_by_type
        .iter()
        .map(|a| (a.total * 100.0) as i64)
        .sum();

    // Add bank account balances (checking/savings as positive, credit cards as negative)
    let bank_assets = get_bank_account_assets(&conn)?;
    let mut bank_cash_cents: i64 = 0;
    let mut bank_cc_cents: i64 = 0;
    let mut bank_cash_count: i64 = 0;
    let mut bank_cc_count: i64 = 0;
    for ba in &bank_assets {
        if ba.asset_type == "Credit Card" {
            bank_cc_cents += ba.current_value_cents; // negative value
            bank_cc_count += 1;
        } else {
            bank_cash_cents += ba.current_value_cents;
            bank_cash_count += 1;
        }
    }
    if bank_cash_count > 0 {
        // Merge into existing Cash entry or add new one
        if let Some(existing) = assets_by_type.iter_mut().find(|a| a.asset_type == "Cash") {
            existing.total += bank_cash_cents as f64 / 100.0;
            existing.count += bank_cash_count;
        } else {
            assets_by_type.push(AssetTypeTotal {
                asset_type: "Cash".to_string(),
                total: bank_cash_cents as f64 / 100.0,
                count: bank_cash_count,
            });
        }
        total_assets_cents += bank_cash_cents;
    }

    // Liabilities by type
    let mut stmt = conn
        .prepare(
            "SELECT liability_type, SUM(current_balance_cents), COUNT(*)
             FROM liabilities
             GROUP BY liability_type",
        )
        .map_err(|e| e.to_string())?;

    let mut liabilities_by_type: Vec<LiabilityTypeTotal> = stmt
        .query_map([], |row| {
            Ok(LiabilityTypeTotal {
                liability_type: row.get(0)?,
                total: row.get::<_, i64>(1)? as f64 / 100.0,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse liability type row: {}", e);
                None
            }
        })
        .collect();

    let mut total_liabilities_cents: i64 = liabilities_by_type
        .iter()
        .map(|l| (l.total * 100.0) as i64)
        .sum();

    // Add credit card balances (they're negative in transactions, so abs value is the debt)
    if bank_cc_count > 0 {
        let cc_debt = bank_cc_cents.abs();
        if let Some(existing) = liabilities_by_type.iter_mut().find(|l| l.liability_type == "Credit Card") {
            existing.total += cc_debt as f64 / 100.0;
            existing.count += bank_cc_count;
        } else {
            liabilities_by_type.push(LiabilityTypeTotal {
                liability_type: "Credit Card".to_string(),
                total: cc_debt as f64 / 100.0,
                count: bank_cc_count,
            });
        }
        total_liabilities_cents += cc_debt;
    }

    // Previous month snapshot for comparison
    let prev_net_worth: Option<f64> = conn
        .query_row(
            "SELECT net_worth_cents FROM net_worth_snapshots
             WHERE snapshot_date < date('now', 'start of month')
             ORDER BY snapshot_date DESC
             LIMIT 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .map(|cents| cents as f64 / 100.0);

    Ok(NetWorthSummary {
        total_assets: total_assets_cents as f64 / 100.0,
        total_liabilities: total_liabilities_cents as f64 / 100.0,
        net_worth: (total_assets_cents - total_liabilities_cents) as f64 / 100.0,
        prev_net_worth,
        assets_by_type,
        liabilities_by_type,
    })
}

#[tauri::command]
pub fn get_net_worth_history(
    state: State<'_, DbState>,
    months: i32,
) -> Result<Vec<NetWorthSnapshot>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let interval = format!("-{} months", months);
    let mut stmt = conn
        .prepare(
            "SELECT id, snapshot_date, total_assets_cents, total_liabilities_cents,
                    net_worth_cents, breakdown_json, created_at
             FROM net_worth_snapshots
             WHERE snapshot_date >= date('now', ?1)
             ORDER BY snapshot_date",
        )
        .map_err(|e| e.to_string())?;

    let snapshots = stmt
        .query_map([&interval], |row| {
            Ok(NetWorthSnapshot {
                id: row.get(0)?,
                snapshot_date: row.get(1)?,
                total_assets_cents: row.get(2)?,
                total_liabilities_cents: row.get(3)?,
                net_worth_cents: row.get(4)?,
                breakdown_json: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse snapshot row: {}", e);
                None
            }
        })
        .collect();

    Ok(snapshots)
}

#[tauri::command]
pub fn take_net_worth_snapshot(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Sum total assets from assets table
    let mut total_assets_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(current_value_cents), 0) FROM assets",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Add bank account balances (checking/savings)
    let bank_checking_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(t.amount_cents), 0)
             FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             WHERE a.account_type IN ('checking', 'savings')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    total_assets_cents += bank_checking_cents;

    // Sum total liabilities from liabilities table
    let mut total_liabilities_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(current_balance_cents), 0) FROM liabilities",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Add credit card balances as liabilities (they're negative in transactions)
    let bank_cc_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(t.amount_cents), 0)
             FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             WHERE a.account_type = 'credit_card'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    total_liabilities_cents += bank_cc_cents.abs();

    let net_worth_cents = total_assets_cents - total_liabilities_cents;

    // Build breakdown JSON
    let mut breakdown: HashMap<String, i64> = HashMap::new();

    let mut stmt = conn
        .prepare("SELECT asset_type, SUM(current_value_cents) FROM assets GROUP BY asset_type")
        .map_err(|e| e.to_string())?;
    let asset_breakdown: Vec<(String, i64)> = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    for (k, v) in asset_breakdown {
        *breakdown.entry(k).or_insert(0) += v;
    }
    *breakdown.entry("Cash".to_string()).or_insert(0) += bank_checking_cents;

    let breakdown_json = serde_json::to_string(&breakdown).map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT OR REPLACE INTO net_worth_snapshots
            (id, snapshot_date, total_assets_cents, total_liabilities_cents, net_worth_cents, breakdown_json)
         VALUES (?1, date('now'), ?2, ?3, ?4, ?5)",
        rusqlite::params![id, total_assets_cents, total_liabilities_cents, net_worth_cents, breakdown_json],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ─────────────────────────────────────────────
// Sync asset value from linked account
// ─────────────────────────────────────────────

#[tauri::command]
pub fn sync_asset_from_account(
    state: State<'_, DbState>,
    asset_id: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Get the linked_account_id for this asset
    let linked_account_id: Option<String> = conn
        .query_row(
            "SELECT linked_account_id FROM assets WHERE id = ?1",
            [&asset_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Asset not found: {}", e))?;

    let account_id = match linked_account_id {
        Some(id) => id,
        None => return Err("Asset has no linked account".to_string()),
    };

    // Sum transactions for the linked account
    let balance_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE account_id = ?1",
            [&account_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE assets SET current_value_cents = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![balance_cents, asset_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
