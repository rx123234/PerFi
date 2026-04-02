use crate::db::DbState;
use crate::models::*;
use std::collections::HashMap;
use tauri::State;

const NO_TRANSFER: &str =
    "t.category_id NOT IN (SELECT id FROM categories WHERE name = 'Transfer')";

/// Returns the account-type-aware income predicate (checking credits only).
fn income_pred() -> &'static str {
    "a.account_type = 'checking' AND t.amount_cents > 0"
}

/// Returns the account-type-aware spending predicate (CC charges + checking debits).
/// Teller convention: CC charges are positive (amount owed), checking debits are negative.
fn spending_pred() -> &'static str {
    "(a.account_type = 'credit_card' AND t.amount_cents > 0) OR (a.account_type IN ('checking', 'savings') AND t.amount_cents < 0)"
}

/// SQL expression that normalizes spending amounts to positive values.
/// All spending amounts are negative (Teller convention), so ABS() makes them positive.
fn spending_amount() -> &'static str {
    "ABS(t.amount_cents)"
}

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
        mapped.filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse dashboard row: {}", e); None }
        }).collect()
    } else {
        let mapped = stmt
            .query_map(rusqlite::params![start_date, end_date], |row| {
                Ok((row.get::<_, T>(0)?, row.get::<_, U>(1)?, row.get::<_, V>(2)?))
            })
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse dashboard row: {}", e); None }
        }).collect()
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
        mapped.filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse dashboard row: {}", e); None }
        }).collect()
    } else {
        let mapped = stmt
            .query_map(rusqlite::params![start_date, end_date], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse dashboard row: {}", e); None }
        }).collect()
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

    let acc_filter = if account_id.is_some() { "AND t.account_id = ?3" } else { "" };

    let income_sql = format!(
        "SELECT COALESCE(CAST(SUM(t.amount_cents) AS REAL) / 100.0, 0)
         FROM transactions t JOIN accounts a ON t.account_id = a.id
         WHERE {} AND t.date >= ?1 AND t.date <= ?2 {} AND t.pending = 0 AND {}",
        income_pred(), acc_filter, NO_TRANSFER
    );
    let spending_sql = format!(
        "SELECT COALESCE(CAST(SUM({amount}) AS REAL) / 100.0, 0)
         FROM transactions t JOIN accounts a ON t.account_id = a.id
         WHERE ({pred}) AND t.date >= ?1 AND t.date <= ?2 {acc} AND t.pending = 0 AND {no_transfer}",
        amount = spending_amount(), pred = spending_pred(), acc = acc_filter, no_transfer = NO_TRANSFER
    );

    let query_scalar = |sql: &str, start: &str, end: &str| -> Result<f64, String> {
        if let Some(ref acc) = account_id {
            conn.query_row(sql, rusqlite::params![start, end, acc], |row| row.get(0))
        } else {
            conn.query_row(sql, rusqlite::params![start, end], |row| row.get(0))
        }
        .map_err(|e| e.to_string())
    };

    let income = query_scalar(&income_sql, &start_date, &end_date)?;
    let spending = query_scalar(&spending_sql, &start_date, &end_date)?;
    let prev_income = query_scalar(&income_sql, &prev_start_date, &prev_end_date)?;
    let prev_spending = query_scalar(&spending_sql, &prev_start_date, &prev_end_date)?;

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

    let acc_filter = if account_id.is_some() { "AND t.account_id = ?3" } else { "" };
    let sql = format!(
        "SELECT COALESCE(t.category_id, 'cat-uncategorized'), COALESCE(c.name, 'Uncategorized'),
                COALESCE(c.color, '#BDBDBD'), CAST(SUM({amount}) AS REAL) / 100.0
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE ({pred}) AND t.date >= ?1 AND t.date <= ?2 {acc} AND t.pending = 0
               AND COALESCE(c.name, '') != 'Transfer' AND {no_transfer}
         GROUP BY COALESCE(t.category_id, 'cat-uncategorized')
         ORDER BY SUM({amount}) DESC",
        amount = spending_amount(), pred = spending_pred(), acc = acc_filter, no_transfer = NO_TRANSFER
    );

    let rows = query_rows_4(&conn, &sql, &start_date, &end_date, &account_id)?;
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
        _ => "%Y-%m",
    };

    let acc_filter = if account_id.is_some() { "AND t.account_id = ?3" } else { "" };
    let no_transfer = NO_TRANSFER;

    let sql = format!(
        "SELECT strftime('{fmt}', t.date) as period,
                CAST(COALESCE(SUM(CASE WHEN {income} THEN t.amount_cents ELSE 0 END), 0) AS REAL) / 100.0 as income,
                CAST(COALESCE(SUM(CASE WHEN {spending} THEN {amount} ELSE 0 END), 0) AS REAL) / 100.0 as spending
         FROM transactions t JOIN accounts a ON t.account_id = a.id
         WHERE t.date >= ?1 AND t.date <= ?2 {acc} AND t.pending = 0 AND {no_transfer}
         GROUP BY period ORDER BY period",
        fmt = date_format,
        income = income_pred(),
        spending = spending_pred(),
        amount = spending_amount(),
        acc = acc_filter,
        no_transfer = no_transfer,
    );

    let periods: Vec<(String, f64, f64)> = query_rows_3(&conn, &sql, &start_date, &end_date, &account_id)?;

    let cat_sql = format!(
        "SELECT strftime('{fmt}', t.date) as period, COALESCE(c.name, 'Uncategorized'),
                COALESCE(c.color, '#BDBDBD'), COALESCE(CAST(SUM({amount}) AS REAL) / 100.0, 0)
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE ({spending}) AND t.date >= ?1 AND t.date <= ?2 {acc} AND t.pending = 0
               AND COALESCE(c.name, '') != 'Transfer' AND {no_transfer}
         GROUP BY period, COALESCE(c.name, 'Uncategorized')
         ORDER BY period",
        fmt = date_format,
        amount = spending_amount(),
        spending = spending_pred(),
        acc = acc_filter,
        no_transfer = no_transfer,
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

    let acc_filter = if account_id.is_some() { "AND t.account_id = ?3" } else { "" };
    let no_transfer = NO_TRANSFER;

    let sql = format!(
        "SELECT a.name, COALESCE(c.name, 'Uncategorized'), CAST(SUM({amount}) AS REAL) / 100.0
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE ({pred}) AND t.date >= ?1 AND t.date <= ?2 {acc} AND t.pending = 0
               AND COALESCE(c.name, '') != 'Transfer' AND {no_transfer}
         GROUP BY a.name, COALESCE(c.name, 'Uncategorized')",
        amount = spending_amount(), pred = spending_pred(), acc = acc_filter, no_transfer = no_transfer
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

    let rows: Vec<(String, String, f64)> =
        query_rows_3(&conn, &sql, &start_date, &end_date, &account_id)?;

    for (account_name, category_name, amount) in &rows {
        let account_idx = get_or_add_node(account_name, &mut nodes);
        let cat_idx = get_or_add_node(category_name, &mut nodes);
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
        .prepare(&format!(
            "SELECT COALESCE(t.merchant, t.description) as m,
                    CAST(SUM({amount}) AS REAL) / 100.0 as total, COUNT(*) as cnt
             FROM transactions t JOIN accounts a ON t.account_id = a.id
             WHERE ({pred}) AND t.date >= ?1 AND t.date <= ?2 AND (?3 IS NULL OR t.account_id = ?3)
               AND t.pending = 0 AND {no_transfer}
             GROUP BY m ORDER BY total DESC LIMIT ?4",
            amount = spending_amount(), pred = spending_pred(), no_transfer = NO_TRANSFER
        ))
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

    Ok(mapped.filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse dashboard row: {}", e); None }
        }).collect())
}

#[tauri::command]
pub fn get_account_balances(state: State<'_, DbState>) -> Result<Vec<AccountBalance>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.name, a.account_type, a.institution, a.mask,
                    COALESCE(CAST(SUM(t.amount_cents) AS REAL) / 100.0, 0) as tx_balance,
                    a.balance_cents
             FROM accounts a
             LEFT JOIN transactions t ON a.id = t.account_id AND t.pending = 0
             GROUP BY a.id
             ORDER BY a.name",
        )
        .map_err(|e| e.to_string())?;

    let mapped = stmt
        .query_map([], |row| {
            let tx_balance: f64 = row.get(5)?;
            let api_balance_cents: Option<i64> = row.get(6)?;
            let balance = api_balance_cents
                .map(|c| c as f64 / 100.0)
                .unwrap_or(tx_balance);
            Ok(AccountBalance {
                account_id: row.get(0)?,
                account_name: row.get(1)?,
                account_type: row.get(2)?,
                institution: row.get(3)?,
                mask: row.get(4)?,
                balance,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(mapped.filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse dashboard row: {}", e); None }
        }).collect())
}

/// Computes (start_date, end_date) as "YYYY-MM-DD" strings for a window
/// of `trailing_months` months ending today.
fn trailing_months_range(trailing_months: i32) -> (String, String) {
    use std::time::{SystemTime, UNIX_EPOCH};

    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let days_since_epoch = secs / 86400;
    let (year, month, day) = days_to_ymd(days_since_epoch as i64);

    let end_date = format!("{:04}-{:02}-{:02}", year, month, day);

    // Step back trailing_months months
    let total_months = (year as i32) * 12 + (month as i32) - 1 - trailing_months;
    let start_year = total_months / 12;
    let start_month = total_months % 12 + 1;
    let start_date = format!("{:04}-{:02}-01", start_year, start_month);

    (start_date, end_date)
}

fn days_to_ymd(days: i64) -> (i64, i64, i64) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[tauri::command]
pub fn get_spending_breakdown(
    state: State<'_, DbState>,
    trailing_months: i32,
) -> Result<SpendingBreakdown, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let (start_date, end_date) = trailing_months_range(trailing_months);

    let sql = format!(
        "SELECT strftime('%Y-%m', t.date) as month,
                COALESCE(c.name, 'Uncategorized') as cat_name,
                COALESCE(c.color, '#737373') as cat_color,
                CAST(SUM({amount}) AS REAL) / 100.0 as total_amount
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE ({pred})
           AND t.date >= ?1 AND t.date <= ?2
           AND t.pending = 0
           AND {no_transfer}
         GROUP BY month, cat_name, cat_color
         ORDER BY month, total_amount DESC",
        amount = spending_amount(),
        pred = spending_pred(),
        no_transfer = NO_TRANSFER,
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let raw_rows: Vec<(String, String, String, f64)> = stmt
        .query_map(rusqlite::params![start_date, end_date], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: spending_breakdown row error: {}", e); None }
        })
        .collect();

    // Collect ordered unique months
    let mut months: Vec<String> = Vec::new();
    for (month, _, _, _) in &raw_rows {
        if !months.contains(month) {
            months.push(month.clone());
        }
    }
    months.sort();

    // Collect unique categories in first-seen order
    let mut cat_order: Vec<(String, String)> = Vec::new();
    for (_, cat_name, cat_color, _) in &raw_rows {
        if !cat_order.iter().any(|(n, _)| n == cat_name) {
            cat_order.push((cat_name.clone(), cat_color.clone()));
        }
    }

    // Build lookup: (month, cat_name) -> amount
    let mut lookup: HashMap<(String, String), f64> = HashMap::new();
    for (month, cat_name, _, amount) in &raw_rows {
        lookup.insert((month.clone(), cat_name.clone()), *amount);
    }

    let mut monthly_totals: Vec<f64> = vec![0.0; months.len()];
    let mut categories: Vec<SpendingCategory> = cat_order
        .into_iter()
        .map(|(name, color)| {
            let amounts: Vec<f64> = months
                .iter()
                .enumerate()
                .map(|(i, month)| {
                    let amt = *lookup.get(&(month.clone(), name.clone())).unwrap_or(&0.0);
                    monthly_totals[i] += amt;
                    amt
                })
                .collect();
            let total: f64 = amounts.iter().sum();
            SpendingCategory { name, color, amounts, total }
        })
        .collect();

    // Sort categories by total descending
    categories.sort_by(|a, b| b.total.partial_cmp(&a.total).unwrap_or(std::cmp::Ordering::Equal));

    let grand_total: f64 = monthly_totals.iter().sum();

    Ok(SpendingBreakdown { months, categories, monthly_totals, grand_total })
}

#[tauri::command]
pub fn get_fixed_costs(
    state: State<'_, DbState>,
    trailing_months: i32,
    min_months: Option<i32>,
) -> Result<FixedCostsAnalysis, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let min_months = min_months.unwrap_or_else(|| std::cmp::max(2, trailing_months / 2));
    let (start_date, end_date) = trailing_months_range(trailing_months);

    let sql = format!(
        "SELECT strftime('%Y-%m', t.date) as month,
                COALESCE(t.merchant, t.description) as merchant_name,
                COALESCE(c.name, 'Uncategorized') as cat_name,
                COALESCE(c.color, '#737373') as cat_color,
                CAST(SUM({amount}) AS REAL) / 100.0 as total_amount
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE ({pred})
           AND t.date >= ?1 AND t.date <= ?2
           AND t.pending = 0
           AND {no_transfer}
         GROUP BY month, merchant_name
         ORDER BY merchant_name, month",
        amount = spending_amount(),
        pred = spending_pred(),
        no_transfer = NO_TRANSFER,
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let raw_rows: Vec<(String, String, String, String, f64)> = stmt
        .query_map(rusqlite::params![start_date, end_date], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: fixed_costs row error: {}", e); None }
        })
        .collect();

    // Collect ordered unique months
    let mut months: Vec<String> = Vec::new();
    for (month, _, _, _, _) in &raw_rows {
        if !months.contains(month) {
            months.push(month.clone());
        }
    }
    months.sort();

    // Group by merchant: merchant -> Vec<(month, cat, color, amount)>
    let mut merchant_map: HashMap<String, Vec<(String, String, String, f64)>> = HashMap::new();
    for (month, merchant, cat, color, amount) in &raw_rows {
        merchant_map
            .entry(merchant.clone())
            .or_default()
            .push((month.clone(), cat.clone(), color.clone(), *amount));
    }

    // Build items for merchants appearing in >= min_months distinct months
    let mut items: Vec<FixedCostItem> = merchant_map
        .into_iter()
        .filter(|(_, entries)| {
            let distinct: std::collections::HashSet<&String> =
                entries.iter().map(|(m, _, _, _)| m).collect();
            (distinct.len() as i32) >= min_months
        })
        .map(|(merchant, entries)| {
            // Take category/color from the most recent entry (entries ordered by month from SQL)
            let (_, category, color, _) = entries.last().cloned().unwrap_or_default();

            let month_lookup: HashMap<&String, f64> =
                entries.iter().map(|(m, _, _, amt)| (m, *amt)).collect();

            let amounts: Vec<Option<f64>> = months
                .iter()
                .map(|m| month_lookup.get(m).copied())
                .collect();

            let present_amounts: Vec<f64> = amounts.iter().filter_map(|a| *a).collect();
            let frequency = present_amounts.len() as i32;
            let avg_amount = if frequency > 0 {
                present_amounts.iter().sum::<f64>() / frequency as f64
            } else {
                0.0
            };

            FixedCostItem { merchant, category, color, amounts, avg_amount, frequency }
        })
        .collect();

    // Sort by avg_amount descending
    items.sort_by(|a, b| {
        b.avg_amount.partial_cmp(&a.avg_amount).unwrap_or(std::cmp::Ordering::Equal)
    });

    // Monthly totals: sum of all fixed-cost amounts per month slot
    let monthly_totals: Vec<f64> = months
        .iter()
        .enumerate()
        .map(|(i, _)| items.iter().map(|item| item.amounts[i].unwrap_or(0.0)).sum())
        .collect();

    let total_monthly_avg = if !months.is_empty() {
        monthly_totals.iter().sum::<f64>() / months.len() as f64
    } else {
        0.0
    };

    Ok(FixedCostsAnalysis { months, items, monthly_totals, total_monthly_avg })
}
