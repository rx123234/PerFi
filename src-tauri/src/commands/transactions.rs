use crate::db::DbState;
use crate::models::{Transaction, TransactionFilter};
use tauri::State;

#[tauri::command]
pub fn get_transactions(
    state: State<'_, DbState>,
    filter: TransactionFilter,
) -> Result<Vec<Transaction>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut sql = String::from(
        "SELECT t.id, t.account_id, t.date, CAST(t.amount_cents AS REAL) / 100.0, t.description, t.enriched_desc,
                t.category_id, c.name as category_name, t.merchant, t.source, t.pending, t.exclude_from_planning, t.created_at
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE 1=1",
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref account_id) = filter.account_id {
        sql.push_str(" AND t.account_id = ?");
        params.push(Box::new(account_id.clone()));
    }
    if let Some(ref category_id) = filter.category_id {
        if category_id == "cat-uncategorized" {
            sql.push_str(" AND (t.category_id IS NULL OR t.category_id = 'cat-uncategorized')");
        } else {
            sql.push_str(" AND t.category_id = ?");
            params.push(Box::new(category_id.clone()));
        }
    }
    if let Some(ref start_date) = filter.start_date {
        sql.push_str(" AND t.date >= ?");
        params.push(Box::new(start_date.clone()));
    }
    if let Some(ref end_date) = filter.end_date {
        sql.push_str(" AND t.date <= ?");
        params.push(Box::new(end_date.clone()));
    }
    if let Some(ref search) = filter.search {
        sql.push_str(" AND (t.description LIKE ? OR t.merchant LIKE ?)");
        let pattern = format!("%{}%", search);
        params.push(Box::new(pattern.clone()));
        params.push(Box::new(pattern));
    }

    sql.push_str(" ORDER BY t.date DESC, t.created_at DESC");

    // Enforce bounds on LIMIT/OFFSET to prevent abuse
    let limit = filter.limit.unwrap_or(50).max(1).min(10000);
    let offset = filter.offset.unwrap_or(0).max(0);
    sql.push_str(" LIMIT ?");
    params.push(Box::new(limit));
    sql.push_str(" OFFSET ?");
    params.push(Box::new(offset));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let transactions = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(Transaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                date: row.get(2)?,
                amount: row.get(3)?,
                description: row.get(4)?,
                enriched_desc: row.get(5)?,
                category_id: row.get(6)?,
                category_name: row.get(7)?,
                merchant: row.get(8)?,
                source: row.get(9)?,
                pending: row.get::<_, i32>(10)? != 0,
                exclude_from_planning: row.get::<_, i32>(11)? != 0,
                created_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(tx) => Some(tx),
            Err(e) => {
                eprintln!("Warning: failed to parse transaction row: {}", e);
                None
            }
        })
        .collect();

    Ok(transactions)
}

#[tauri::command]
pub fn update_transaction_category(
    state: State<'_, DbState>,
    transaction_id: String,
    category_id: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute(
            "UPDATE transactions SET category_id = ?1 WHERE id = ?2",
            rusqlite::params![category_id, transaction_id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Transaction not found: {}", transaction_id));
    }
    Ok(())
}

#[tauri::command]
pub fn update_transaction_planning_exclusion(
    state: State<'_, DbState>,
    transaction_id: String,
    exclude_from_planning: bool,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute(
            "UPDATE transactions SET exclude_from_planning = ?1 WHERE id = ?2",
            rusqlite::params![exclude_from_planning as i32, transaction_id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Transaction not found: {}", transaction_id));
    }
    Ok(())
}

#[tauri::command]
pub fn get_transaction_count(
    state: State<'_, DbState>,
    filter: TransactionFilter,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut sql = String::from("SELECT COUNT(*) FROM transactions t WHERE 1=1");
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref account_id) = filter.account_id {
        sql.push_str(" AND t.account_id = ?");
        params.push(Box::new(account_id.clone()));
    }
    if let Some(ref category_id) = filter.category_id {
        if category_id == "cat-uncategorized" {
            sql.push_str(" AND (t.category_id IS NULL OR t.category_id = 'cat-uncategorized')");
        } else {
            sql.push_str(" AND t.category_id = ?");
            params.push(Box::new(category_id.clone()));
        }
    }
    if let Some(ref start_date) = filter.start_date {
        sql.push_str(" AND t.date >= ?");
        params.push(Box::new(start_date.clone()));
    }
    if let Some(ref end_date) = filter.end_date {
        sql.push_str(" AND t.date <= ?");
        params.push(Box::new(end_date.clone()));
    }
    if let Some(ref search) = filter.search {
        sql.push_str(" AND (t.description LIKE ? OR t.merchant LIKE ?)");
        let pattern = format!("%{}%", search);
        params.push(Box::new(pattern.clone()));
        params.push(Box::new(pattern));
    }

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let count: i64 = conn
        .query_row(&sql, param_refs.as_slice(), |row| row.get(0))
        .map_err(|e| e.to_string())?;

    Ok(count)
}
