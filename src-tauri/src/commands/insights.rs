use crate::db::DbState;
use crate::models::*;
use chrono::{Datelike, Utc};
use serde_json::json;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_insights(
    state: State<'_, DbState>,
    unread_only: bool,
) -> Result<Vec<Insight>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let sql = if unread_only {
        "SELECT id, insight_type, title, body, severity, data_json, is_read, is_dismissed,
                expires_at, created_at
         FROM insights
         WHERE is_dismissed = 0 AND is_read = 0
         ORDER BY created_at DESC
         LIMIT 50"
    } else {
        "SELECT id, insight_type, title, body, severity, data_json, is_read, is_dismissed,
                expires_at, created_at
         FROM insights
         WHERE is_dismissed = 0
         ORDER BY created_at DESC
         LIMIT 50"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let insights = stmt
        .query_map([], |row| {
            Ok(Insight {
                id: row.get(0)?,
                insight_type: row.get(1)?,
                title: row.get(2)?,
                body: row.get(3)?,
                severity: row.get(4)?,
                data_json: row.get(5)?,
                is_read: row.get(6)?,
                is_dismissed: row.get(7)?,
                expires_at: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse insight row: {}", e);
                None
            }
        })
        .collect();

    Ok(insights)
}

#[tauri::command]
pub fn dismiss_insight(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute(
            "UPDATE insights SET is_dismissed = 1 WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Insight not found: {}", id));
    }
    Ok(())
}

#[tauri::command]
pub fn mark_insight_read(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute(
            "UPDATE insights SET is_read = 1 WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Insight not found: {}", id));
    }
    Ok(())
}

/// Insert a single insight row and return the constructed struct.
fn insert_insight(
    conn: &rusqlite::Connection,
    insight_type: &str,
    title: &str,
    body: &str,
    severity: &str,
    data_json: Option<String>,
) -> Result<Insight, String> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO insights (id, insight_type, title, body, severity, data_json, is_read, is_dismissed, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7)",
        rusqlite::params![id, insight_type, title, body, severity, data_json, created_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(Insight {
        id,
        insight_type: insight_type.to_string(),
        title: title.to_string(),
        body: body.to_string(),
        severity: severity.to_string(),
        data_json: None,
        is_read: false,
        is_dismissed: false,
        expires_at: None,
        created_at,
    })
}

#[tauri::command]
pub fn generate_insights(state: State<'_, DbState>) -> Result<Vec<Insight>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut new_insights: Vec<Insight> = Vec::new();

    let now = Utc::now().date_naive();
    let current_month_start = format!("{}-{:02}-01", now.year(), now.month());
    // Previous month: go back one month
    let prev_month_date = if now.month() == 1 {
        chrono::NaiveDate::from_ymd_opt(now.year() - 1, 12, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(now.year(), now.month() - 1, 1).unwrap()
    };
    let prev_month_start = prev_month_date.format("%Y-%m-%d").to_string();
    let prev_month_end = format!(
        "{}-{:02}-{:02}",
        now.year(),
        now.month(),
        1
    );
    // 3 months ago for baseline
    let three_months_ago = {
        let total_months = now.year() as i32 * 12 + now.month() as i32 - 1 - 3;
        let y = total_months / 12;
        let m = total_months % 12 + 1;
        format!("{:04}-{:02}-01", y, m)
    };

    // ─── Spending alerts ───────────────────────────────────────────────────────
    {
        // Get categories with spending in the current month
        let mut stmt = conn
            .prepare(
                "SELECT t.category_id, COALESCE(c.name, 'Uncategorized'),
                        CAST(SUM(ABS(t.amount_cents)) AS REAL) / 100.0
                 FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE t.amount_cents < 0
                   AND t.date >= ?1
                   AND t.pending = 0
                   AND COALESCE(c.name, '') NOT IN ('Transfer', 'Income')
                   AND t.category_id NOT IN (
                       SELECT id FROM categories WHERE name IN ('Transfer', 'Income')
                   )
                 GROUP BY t.category_id",
            )
            .map_err(|e| e.to_string())?;

        let current_spending: Vec<(Option<String>, String, f64)> = stmt
            .query_map(rusqlite::params![current_month_start], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (cat_id, cat_name, current_amount) in &current_spending {
            // Average over prior 3 full months
            let avg: f64 = conn
                .query_row(
                    "SELECT COALESCE(AVG(monthly_total), 0) FROM (
                         SELECT strftime('%Y-%m', t.date) as mo,
                                CAST(SUM(ABS(t.amount_cents)) AS REAL) / 100.0 as monthly_total
                         FROM transactions t
                         JOIN accounts a ON t.account_id = a.id
                         LEFT JOIN categories c ON t.category_id = c.id
                         WHERE t.amount_cents < 0
                           AND t.date >= ?1
                           AND t.date < ?2
                           AND t.pending = 0
                           AND (t.category_id = ?3 OR (?3 IS NULL AND t.category_id IS NULL))
                         GROUP BY mo
                     )",
                    rusqlite::params![three_months_ago, current_month_start, cat_id],
                    |row| row.get(0),
                )
                .unwrap_or(0.0);

            if avg > 0.0 && *current_amount > avg * 1.2 {
                let pct = ((*current_amount - avg) / avg * 100.0).round() as i64;
                let title = format!("Spending spike in {}", cat_name);
                let body = format!(
                    "You've spent ${:.0} in {} this month, {:.0}% above your 3-month average of ${:.0}.",
                    current_amount, cat_name, pct, avg
                );
                let data = serde_json::to_string(&json!({
                    "category": cat_name,
                    "current": current_amount,
                    "avg_3month": avg,
                    "pct_increase": pct
                }))
                .ok();
                if let Ok(insight) =
                    insert_insight(&conn, "spending_alert", &title, &body, "warning", data)
                {
                    new_insights.push(insight);
                }
            }
        }
    }

    // ─── Savings rate trend ────────────────────────────────────────────────────
    {
        let compute_savings_rate = |start: &str, end: &str| -> f64 {
            let income: f64 = conn
                .query_row(
                    "SELECT COALESCE(CAST(SUM(t.amount_cents) AS REAL) / 100.0, 0)
                     FROM transactions t
                     JOIN accounts a ON t.account_id = a.id
                     WHERE a.account_type = 'checking' AND t.amount_cents > 0
                       AND t.date >= ?1 AND t.date < ?2 AND t.pending = 0",
                    rusqlite::params![start, end],
                    |row| row.get(0),
                )
                .unwrap_or(0.0);

            let spending: f64 = conn
                .query_row(
                    "SELECT COALESCE(CAST(SUM(ABS(t.amount_cents)) AS REAL) / 100.0, 0)
                     FROM transactions t
                     JOIN accounts a ON t.account_id = a.id
                     WHERE t.amount_cents < 0 AND t.date >= ?1 AND t.date < ?2 AND t.pending = 0",
                    rusqlite::params![start, end],
                    |row| row.get(0),
                )
                .unwrap_or(0.0);

            if income > 0.0 {
                (income - spending) / income
            } else {
                0.0
            }
        };

        let current_end = now.format("%Y-%m-%d").to_string();
        let current_rate = compute_savings_rate(&current_month_start, &current_end);
        let prev_rate = compute_savings_rate(&prev_month_start, &prev_month_end);

        if current_rate < prev_rate - 0.05 {
            let drop_pct = ((prev_rate - current_rate) * 100.0).round() as i64;
            let title = "Savings rate declining".to_string();
            let body = format!(
                "Your savings rate this month ({:.0}%) is {:.0} percentage points below last month ({:.0}%).",
                current_rate * 100.0,
                drop_pct,
                prev_rate * 100.0
            );
            let data = serde_json::to_string(&json!({
                "current_rate": current_rate,
                "prev_rate": prev_rate
            }))
            .ok();
            if let Ok(insight) =
                insert_insight(&conn, "savings_trend", &title, &body, "warning", data)
            {
                new_insights.push(insight);
            }
        }
    }

    // ─── Lifestyle inflation (quarterly, YoY) ──────────────────────────────────
    {
        let one_year_ago = {
            let total_months = now.year() as i32 * 12 + now.month() as i32 - 1 - 12;
            let y = total_months / 12;
            let m = total_months % 12 + 1;
            format!("{:04}-{:02}-01", y, m)
        };
        let two_years_ago = {
            let total_months = now.year() as i32 * 12 + now.month() as i32 - 1 - 24;
            let y = total_months / 12;
            let m = total_months % 12 + 1;
            format!("{:04}-{:02}-01", y, m)
        };
        let today_str = now.format("%Y-%m-%d").to_string();

        let current_income: f64 = conn
            .query_row(
                "SELECT COALESCE(CAST(SUM(t.amount_cents) AS REAL) / 100.0, 0)
                 FROM transactions t JOIN accounts a ON t.account_id = a.id
                 WHERE a.account_type = 'checking' AND t.amount_cents > 0
                   AND t.date >= ?1 AND t.date < ?2 AND t.pending = 0",
                rusqlite::params![one_year_ago, today_str],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        let prior_income: f64 = conn
            .query_row(
                "SELECT COALESCE(CAST(SUM(t.amount_cents) AS REAL) / 100.0, 0)
                 FROM transactions t JOIN accounts a ON t.account_id = a.id
                 WHERE a.account_type = 'checking' AND t.amount_cents > 0
                   AND t.date >= ?1 AND t.date < ?2 AND t.pending = 0",
                rusqlite::params![two_years_ago, one_year_ago],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        let current_spending: f64 = conn
            .query_row(
                "SELECT COALESCE(CAST(SUM(ABS(t.amount_cents)) AS REAL) / 100.0, 0)
                 FROM transactions t JOIN accounts a ON t.account_id = a.id
                 WHERE t.amount_cents < 0
                   AND t.date >= ?1 AND t.date < ?2 AND t.pending = 0",
                rusqlite::params![one_year_ago, today_str],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        let prior_spending: f64 = conn
            .query_row(
                "SELECT COALESCE(CAST(SUM(ABS(t.amount_cents)) AS REAL) / 100.0, 0)
                 FROM transactions t JOIN accounts a ON t.account_id = a.id
                 WHERE t.amount_cents < 0
                   AND t.date >= ?1 AND t.date < ?2 AND t.pending = 0",
                rusqlite::params![two_years_ago, one_year_ago],
                |row| row.get(0),
            )
            .unwrap_or(0.0);

        if prior_income > 0.0 && prior_spending > 0.0 {
            let income_growth = (current_income - prior_income) / prior_income;
            let spending_growth = (current_spending - prior_spending) / prior_spending;

            if spending_growth > income_growth {
                let title = "Lifestyle inflation detected".to_string();
                let body = format!(
                    "Your spending grew {:.0}% year-over-year while income grew {:.0}%. Consider reviewing discretionary expenses.",
                    spending_growth * 100.0,
                    income_growth * 100.0
                );
                let data = serde_json::to_string(&json!({
                    "income_growth": income_growth,
                    "spending_growth": spending_growth
                }))
                .ok();
                if let Ok(insight) = insert_insight(
                    &conn,
                    "lifestyle_inflation",
                    &title,
                    &body,
                    "warning",
                    data,
                ) {
                    new_insights.push(insight);
                }
            }
        }
    }

    // ─── Milestones (net worth thresholds) ────────────────────────────────────
    {
        let net_worth_cents: i64 = {
            let assets: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(current_value_cents), 0) FROM assets",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            let liabilities: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(current_balance_cents), 0) FROM liabilities",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            assets - liabilities
        };

        let thresholds: &[(i64, &str)] = &[
            (1_000_000, "$10,000"),
            (2_500_000, "$25,000"),
            (5_000_000, "$50,000"),
            (10_000_000, "$100,000"),
            (25_000_000, "$250,000"),
            (50_000_000, "$500,000"),
            (100_000_000, "$1,000,000"),
        ];

        for (threshold_cents, label) in thresholds {
            if net_worth_cents >= *threshold_cents {
                // Check if a milestone insight for this threshold already exists
                let exists: bool = conn
                    .query_row(
                        "SELECT COUNT(*) FROM insights
                         WHERE insight_type = 'milestone'
                           AND data_json LIKE ?1
                           AND is_dismissed = 0",
                        rusqlite::params![format!("%\"threshold\":{}", threshold_cents)],
                        |row| row.get::<_, i64>(0),
                    )
                    .unwrap_or(0)
                    > 0;

                if !exists {
                    let title = format!("Net worth milestone: {}", label);
                    let body = format!(
                        "Congratulations! Your net worth has crossed the {} mark.",
                        label
                    );
                    let data = serde_json::to_string(&json!({
                        "threshold": threshold_cents,
                        "label": label,
                        "net_worth_cents": net_worth_cents
                    }))
                    .ok();
                    if let Ok(insight) =
                        insert_insight(&conn, "milestone", &title, &body, "positive", data)
                    {
                        new_insights.push(insight);
                    }
                }
            }
        }
    }

    // ─── Anomalies ────────────────────────────────────────────────────────────
    {
        // Get all current-month transactions with their categories
        let mut stmt = conn
            .prepare(
                "SELECT t.id, COALESCE(t.merchant, t.description), t.category_id,
                        COALESCE(c.name, 'Uncategorized'), ABS(t.amount_cents)
                 FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE t.amount_cents < 0
                   AND t.date >= ?1
                   AND t.pending = 0
                   AND COALESCE(c.name, '') NOT IN ('Transfer', 'Income')
                 ORDER BY ABS(t.amount_cents) DESC",
            )
            .map_err(|e| e.to_string())?;

        let current_txns: Vec<(String, String, Option<String>, String, i64)> = stmt
            .query_map(rusqlite::params![current_month_start], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut anomaly_count = 0;
        for (txn_id, description, cat_id, cat_name, amount_cents) in &current_txns {
            if anomaly_count >= 5 {
                break;
            }

            // Category monthly average over last 3 months
            let cat_monthly_avg_cents: f64 = conn
                .query_row(
                    "SELECT COALESCE(AVG(monthly_total), 0) FROM (
                         SELECT strftime('%Y-%m', t.date) as mo,
                                SUM(ABS(t.amount_cents)) as monthly_total
                         FROM transactions t
                         WHERE t.amount_cents < 0
                           AND t.date >= ?1
                           AND t.date < ?2
                           AND t.pending = 0
                           AND (t.category_id = ?3 OR (?3 IS NULL AND t.category_id IS NULL))
                         GROUP BY mo
                     )",
                    rusqlite::params![three_months_ago, current_month_start, cat_id],
                    |row| row.get(0),
                )
                .unwrap_or(0.0);

            if cat_monthly_avg_cents > 0.0
                && *amount_cents as f64 > cat_monthly_avg_cents * 3.0
            {
                let deviation = *amount_cents as f64 / cat_monthly_avg_cents;
                let title = format!("Unusual transaction: {}", description);
                let body = format!(
                    "${:.2} charge at {} is {:.1}x your typical monthly {} spending.",
                    *amount_cents as f64 / 100.0,
                    description,
                    deviation,
                    cat_name
                );
                let data = serde_json::to_string(&json!({
                    "transaction_id": txn_id,
                    "amount_cents": amount_cents,
                    "category_avg_cents": cat_monthly_avg_cents,
                    "deviation_factor": deviation
                }))
                .ok();
                if let Ok(insight) =
                    insert_insight(&conn, "anomaly", &title, &body, "action_needed", data)
                {
                    new_insights.push(insight);
                    anomaly_count += 1;
                }
            }
        }
    }

    Ok(new_insights)
}

#[tauri::command]
pub fn get_insight_data_for_ai(state: State<'_, DbState>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let now = Utc::now().date_naive();
    let current_month_start = format!("{}-{:02}-01", now.year(), now.month());
    let today_str = now.format("%Y-%m-%d").to_string();
    let three_months_ago = {
        let total_months = now.year() as i32 * 12 + now.month() as i32 - 1 - 3;
        let y = total_months / 12;
        let m = total_months % 12 + 1;
        format!("{:04}-{:02}-01", y, m)
    };

    // Net worth (assets table + bank account balances)
    let assets_table_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(current_value_cents), 0) FROM assets",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    // Bank accounts: prefer balance_cents (Teller API), fall back to transaction sum
    let bank_asset_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(
                CASE WHEN a.balance_cents IS NOT NULL THEN a.balance_cents
                     ELSE COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id = a.id), 0)
                END
             ), 0)
             FROM accounts a
             WHERE a.account_type IN ('checking', 'savings')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let total_assets_cents = assets_table_cents + bank_asset_cents;

    let liabilities_table_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(current_balance_cents), 0) FROM liabilities",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    // Credit card balances as liabilities
    let cc_debt_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(
                CASE WHEN a.balance_cents IS NOT NULL THEN a.balance_cents
                     ELSE ABS(COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id = a.id), 0))
                END
             ), 0)
             FROM accounts a
             WHERE a.account_type = 'credit_card'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let total_liabilities_cents = liabilities_table_cents + cc_debt_cents;
    let net_worth_cents = total_assets_cents - total_liabilities_cents;

    // Monthly income (current month)
    let monthly_income: f64 = conn
        .query_row(
            "SELECT COALESCE(CAST(SUM(t.amount_cents) AS REAL) / 100.0, 0)
             FROM transactions t JOIN accounts a ON t.account_id = a.id
             WHERE a.account_type = 'checking' AND t.amount_cents > 0
               AND t.date >= ?1 AND t.date <= ?2 AND t.pending = 0",
            rusqlite::params![current_month_start, today_str],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Monthly spending (current month) — CC charges are positive, checking debits are negative
    let monthly_spending: f64 = conn
        .query_row(
            "SELECT COALESCE(CAST(SUM(ABS(t.amount_cents)) AS REAL) / 100.0, 0)
             FROM transactions t JOIN accounts a ON t.account_id = a.id
             WHERE ((a.account_type = 'credit_card' AND t.amount_cents > 0)
                OR (a.account_type IN ('checking', 'savings') AND t.amount_cents < 0))
               AND t.date >= ?1 AND t.date <= ?2 AND t.pending = 0
               AND COALESCE(t.category_id, '') NOT IN ('cat-transfer', 'cat-income')",
            rusqlite::params![current_month_start, today_str],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let savings_rate = if monthly_income > 0.0 {
        (monthly_income - monthly_spending) / monthly_income
    } else {
        0.0
    };

    // Top spending categories (last 3 months)
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(c.name, 'Uncategorized') as cat_name,
                    CAST(SUM(ABS(t.amount_cents)) AS REAL) / 100.0 as total
             FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             LEFT JOIN categories c ON t.category_id = c.id
             WHERE ((a.account_type = 'credit_card' AND t.amount_cents > 0)
                OR (a.account_type IN ('checking', 'savings') AND t.amount_cents < 0))
               AND t.date >= ?1 AND t.date <= ?2
               AND t.pending = 0
               AND COALESCE(c.name, '') NOT IN ('Transfer', 'Income')
             GROUP BY cat_name
             ORDER BY total DESC
             LIMIT 10",
        )
        .map_err(|e| e.to_string())?;

    let top_categories: Vec<serde_json::Value> = stmt
        .query_map(rusqlite::params![three_months_ago, today_str], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(name, total)| json!({ "category": name, "total": total }))
        .collect();

    // Spending trends: month-over-month changes per category
    let mut trend_stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m', t.date) as month,
                    COALESCE(c.name, 'Uncategorized') as cat_name,
                    CAST(SUM(ABS(t.amount_cents)) AS REAL) / 100.0 as total
             FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             LEFT JOIN categories c ON t.category_id = c.id
             WHERE ((a.account_type = 'credit_card' AND t.amount_cents > 0)
                OR (a.account_type IN ('checking', 'savings') AND t.amount_cents < 0))
               AND t.date >= ?1 AND t.date <= ?2
               AND t.pending = 0
               AND COALESCE(c.name, '') NOT IN ('Transfer', 'Income')
             GROUP BY month, cat_name
             ORDER BY month, total DESC",
        )
        .map_err(|e| e.to_string())?;

    let spending_trends: Vec<serde_json::Value> = trend_stmt
        .query_map(rusqlite::params![three_months_ago, today_str], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(month, category, total)| json!({ "month": month, "category": category, "total": total }))
        .collect();

    // Budget status
    let mut budget_stmt = conn
        .prepare(
            "SELECT b.id, COALESCE(c.name, 'Unknown') as cat_name, b.monthly_limit_cents,
                    COALESCE(SUM(ABS(t.amount_cents)), 0) as spent_cents
             FROM budgets b
             LEFT JOIN categories c ON b.category_id = c.id
             LEFT JOIN transactions t ON t.category_id = b.category_id
                 AND t.date >= ?1 AND t.date <= ?2 AND t.pending = 0
             LEFT JOIN accounts a ON t.account_id = a.id
                 AND ((a.account_type = 'credit_card' AND t.amount_cents > 0)
                    OR (a.account_type IN ('checking', 'savings') AND t.amount_cents < 0))
             WHERE b.is_active = 1
             GROUP BY b.id",
        )
        .map_err(|e| e.to_string())?;

    let budget_status: Vec<serde_json::Value> = budget_stmt
        .query_map(rusqlite::params![current_month_start, today_str], |row| {
            Ok((
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(category, limit_cents, spent_cents)| {
            let pct = if limit_cents > 0 {
                spent_cents as f64 / limit_cents as f64 * 100.0
            } else {
                0.0
            };
            json!({
                "category": category,
                "limit": limit_cents as f64 / 100.0,
                "spent": spent_cents as f64 / 100.0,
                "percentage": pct
            })
        })
        .collect();

    // Goals progress
    let mut goal_stmt = conn
        .prepare(
            "SELECT name, goal_type, target_cents, current_cents, status
             FROM goals WHERE status != 'deleted'",
        )
        .map_err(|e| e.to_string())?;

    let goals_progress: Vec<serde_json::Value> = goal_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(name, goal_type, target, current, status)| {
            let pct = if target > 0 {
                current as f64 / target as f64 * 100.0
            } else {
                0.0
            };
            json!({
                "name": name,
                "type": goal_type,
                "target": target as f64 / 100.0,
                "current": current as f64 / 100.0,
                "percentage": pct,
                "status": status
            })
        })
        .collect();

    // Recent anomalies from insights table
    let mut anomaly_stmt = conn
        .prepare(
            "SELECT title, body, created_at FROM insights
             WHERE insight_type = 'anomaly' AND is_dismissed = 0
             ORDER BY created_at DESC LIMIT 5",
        )
        .map_err(|e| e.to_string())?;

    let recent_anomalies: Vec<serde_json::Value> = anomaly_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(title, body, created_at)| {
            json!({ "title": title, "body": body, "created_at": created_at })
        })
        .collect();

    let summary = json!({
        "net_worth": {
            "assets": total_assets_cents as f64 / 100.0,
            "liabilities": total_liabilities_cents as f64 / 100.0,
            "net": net_worth_cents as f64 / 100.0
        },
        "monthly_income": monthly_income,
        "monthly_spending": monthly_spending,
        "savings_rate": savings_rate,
        "top_spending_categories": top_categories,
        "spending_trends": spending_trends,
        "budget_status": budget_status,
        "goals_progress": goals_progress,
        "recent_anomalies": recent_anomalies
    });

    serde_json::to_string_pretty(&summary).map_err(|e| e.to_string())
}
