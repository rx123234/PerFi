use crate::db::DbState;
use crate::models::*;
use tauri::State;

fn query_rows_3<T: rusqlite::types::FromSql + Clone, U: rusqlite::types::FromSql + Clone, V: rusqlite::types::FromSql + Clone>(
    conn: &rusqlite::Connection,
    sql: &str,
    start_date: &str,
    end_date: &str,
    account_id: &Option<String>,
) -> Result<Vec<(T, U, V)>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = if let Some(ref acc) = account_id {
        let mapped = stmt
            .query_map(rusqlite::params![start_date, end_date, acc], |row| {
                Ok((row.get::<_, T>(0)?, row.get::<_, U>(1)?, row.get::<_, V>(2)?))
            })
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| r.ok()).collect()
    } else {
        let mapped = stmt
            .query_map(rusqlite::params![start_date, end_date], |row| {
                Ok((row.get::<_, T>(0)?, row.get::<_, U>(1)?, row.get::<_, V>(2)?))
            })
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| r.ok()).collect()
    };
    Ok(rows)
}

fn query_rows_4(
    conn: &rusqlite::Connection,
    sql: &str,
    start_date: &str,
    end_date: &str,
    account_id: &Option<String>,
) -> Result<Vec<(String, String, String, f64)>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = if let Some(ref acc) = account_id {
        let mapped = stmt
            .query_map(rusqlite::params![start_date, end_date, acc], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| r.ok()).collect()
    } else {
        let mapped = stmt
            .query_map(rusqlite::params![start_date, end_date], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| r.ok()).collect()
    };
    Ok(rows)
}

#[tauri::command]
pub fn get_cash_flow_summary(
    state: State<'_, DbState>,
    start_date: String,
    end_date: String,
    prev_start_date: String,
    prev_end_date: String,
    account_id: Option<String>,
) -> Result<CashFlowSummary, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let query_period = |start: &str, end: &str| -> Result<(f64, f64), String> {
        let (income, spending) = if let Some(ref acc) = account_id {
            let income: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE amount > 0 AND date >= ?1 AND date <= ?2 AND account_id = ?3 AND pending = 0",
                    rusqlite::params![start, end, acc],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            let spending: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions WHERE amount < 0 AND date >= ?1 AND date <= ?2 AND account_id = ?3 AND pending = 0",
                    rusqlite::params![start, end, acc],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            (income, spending)
        } else {
            let income: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE amount > 0 AND date >= ?1 AND date <= ?2 AND pending = 0",
                    rusqlite::params![start, end],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            let spending: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions WHERE amount < 0 AND date >= ?1 AND date <= ?2 AND pending = 0",
                    rusqlite::params![start, end],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            (income, spending)
        };
        Ok((income, spending))
    };

    let (income, spending) = query_period(&start_date, &end_date)?;
    let (prev_income, prev_spending) = query_period(&prev_start_date, &prev_end_date)?;

    Ok(CashFlowSummary {
        income,
        spending,
        net: income - spending,
        prev_income,
        prev_spending,
        prev_net: prev_income - prev_spending,
    })
}

#[tauri::command]
pub fn get_spending_by_category(
    state: State<'_, DbState>,
    start_date: String,
    end_date: String,
    account_id: Option<String>,
) -> Result<Vec<CategorySpending>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let sql = if account_id.is_some() {
        "SELECT COALESCE(t.category_id, 'cat-uncategorized'), COALESCE(c.name, 'Uncategorized'),
                COALESCE(c.color, '#BDBDBD'), SUM(ABS(t.amount))
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.amount < 0 AND t.date >= ?1 AND t.date <= ?2 AND t.account_id = ?3 AND t.pending = 0
         GROUP BY COALESCE(t.category_id, 'cat-uncategorized')
         ORDER BY SUM(ABS(t.amount)) DESC"
    } else {
        "SELECT COALESCE(t.category_id, 'cat-uncategorized'), COALESCE(c.name, 'Uncategorized'),
                COALESCE(c.color, '#BDBDBD'), SUM(ABS(t.amount))
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.amount < 0 AND t.date >= ?1 AND t.date <= ?2 AND t.pending = 0
         GROUP BY COALESCE(t.category_id, 'cat-uncategorized')
         ORDER BY SUM(ABS(t.amount)) DESC"
    };

    let rows = query_rows_4(&conn, sql, &start_date, &end_date, &account_id)?;
    let total: f64 = rows.iter().map(|r| r.3).sum();

    let result = rows
        .into_iter()
        .map(|(cat_id, cat_name, color, amount)| CategorySpending {
            category_id: cat_id,
            category_name: cat_name,
            color,
            amount,
            percentage: if total > 0.0 { (amount / total) * 100.0 } else { 0.0 },
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub fn get_spending_trends(
    state: State<'_, DbState>,
    start_date: String,
    end_date: String,
    granularity: String,
    account_id: Option<String>,
) -> Result<Vec<TrendDataPoint>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let date_format = match granularity.as_str() {
        "weekly" => "%Y-W%W",
        "annual" => "%Y",
        _ => "%Y-%m",
    };

    let base_where = if account_id.is_some() {
        "t.date >= ?1 AND t.date <= ?2 AND t.account_id = ?3 AND t.pending = 0"
    } else {
        "t.date >= ?1 AND t.date <= ?2 AND t.pending = 0"
    };

    let sql = format!(
        "SELECT strftime('{}', t.date) as period,
                COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as spending
         FROM transactions t
         WHERE {}
         GROUP BY period
         ORDER BY period",
        date_format, base_where
    );

    let periods: Vec<(String, f64, f64)> = query_rows_3(&conn, &sql, &start_date, &end_date, &account_id)?;

    let cat_sql = format!(
        "SELECT strftime('{}', t.date) as period, COALESCE(c.name, 'Uncategorized'),
                COALESCE(c.color, '#BDBDBD'), COALESCE(SUM(ABS(t.amount)), 0)
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.amount < 0 AND {}
         GROUP BY period, COALESCE(c.name, 'Uncategorized')
         ORDER BY period",
        date_format, base_where
    );

    let cat_rows = query_rows_4(&conn, &cat_sql, &start_date, &end_date, &account_id)?;

    let result = periods
        .into_iter()
        .map(|(period, income, spending)| {
            let categories = cat_rows
                .iter()
                .filter(|(p, _, _, _)| p == &period)
                .map(|(_, name, color, amount)| CategoryAmount {
                    category_name: name.clone(),
                    color: color.clone(),
                    amount: *amount,
                })
                .collect();
            TrendDataPoint { period, income, spending, categories }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub fn get_sankey_data(
    state: State<'_, DbState>,
    start_date: String,
    end_date: String,
    account_id: Option<String>,
) -> Result<SankeyData, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let base_where = if account_id.is_some() {
        "t.date >= ?1 AND t.date <= ?2 AND t.account_id = ?3 AND t.pending = 0"
    } else {
        "t.date >= ?1 AND t.date <= ?2 AND t.pending = 0"
    };

    let income_sql = format!(
        "SELECT COALESCE(c.name, 'Other Income'), a.name, SUM(t.amount)
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.amount > 0 AND {}
         GROUP BY COALESCE(c.name, 'Other Income'), a.name",
        base_where
    );

    let spending_sql = format!(
        "SELECT a.name, COALESCE(c.name, 'Uncategorized'), SUM(ABS(t.amount))
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.amount < 0 AND {}
         GROUP BY a.name, COALESCE(c.name, 'Uncategorized')",
        base_where
    );

    let mut nodes: Vec<SankeyNode> = Vec::new();
    let mut links: Vec<SankeyLink> = Vec::new();

    let get_or_add_node = |name: &str, nodes: &mut Vec<SankeyNode>| -> usize {
        if let Some(idx) = nodes.iter().position(|n| n.name == name) {
            idx
        } else {
            nodes.push(SankeyNode { name: name.to_string() });
            nodes.len() - 1
        }
    };

    let income_rows: Vec<(String, String, f64)> =
        query_rows_3(&conn, &income_sql, &start_date, &end_date, &account_id)?;

    for (source_name, account_name, amount) in &income_rows {
        let source_idx = get_or_add_node(source_name, &mut nodes);
        let account_idx = get_or_add_node(account_name, &mut nodes);
        links.push(SankeyLink { source: source_idx, target: account_idx, value: *amount });
    }

    let spending_rows: Vec<(String, String, f64)> =
        query_rows_3(&conn, &spending_sql, &start_date, &end_date, &account_id)?;

    for (account_name, category_name, amount) in &spending_rows {
        let account_idx = get_or_add_node(account_name, &mut nodes);
        let cat_display = format!("{} (spend)", category_name);
        let cat_idx = get_or_add_node(&cat_display, &mut nodes);
        links.push(SankeyLink { source: account_idx, target: cat_idx, value: *amount });
    }

    Ok(SankeyData { nodes, links })
}

#[tauri::command]
pub fn get_top_merchants(
    state: State<'_, DbState>,
    start_date: String,
    end_date: String,
    limit: Option<i64>,
    account_id: Option<String>,
) -> Result<Vec<MerchantSpending>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(15);

    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(merchant, description) as m, SUM(ABS(amount)) as total, COUNT(*) as cnt
             FROM transactions
             WHERE amount < 0 AND date >= ?1 AND date <= ?2 AND (?3 IS NULL OR account_id = ?3) AND pending = 0
             GROUP BY m
             ORDER BY total DESC
             LIMIT ?4",
        )
        .map_err(|e| e.to_string())?;

    let mapped = stmt
        .query_map(
            rusqlite::params![start_date, end_date, account_id, limit],
            |row| {
                Ok(MerchantSpending {
                    merchant: row.get(0)?,
                    amount: row.get(1)?,
                    count: row.get(2)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(mapped.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn get_account_balances(state: State<'_, DbState>) -> Result<Vec<AccountBalance>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.name, a.account_type, a.institution, a.mask,
                    COALESCE(SUM(t.amount), 0) as balance
             FROM accounts a
             LEFT JOIN transactions t ON a.id = t.account_id AND t.pending = 0
             GROUP BY a.id
             ORDER BY a.name",
        )
        .map_err(|e| e.to_string())?;

    let mapped = stmt
        .query_map([], |row| {
            Ok(AccountBalance {
                account_id: row.get(0)?,
                account_name: row.get(1)?,
                account_type: row.get(2)?,
                institution: row.get(3)?,
                mask: row.get(4)?,
                balance: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(mapped.filter_map(|r| r.ok()).collect())
}
