use crate::db::DbState;
use crate::models::*;
use chrono::{Datelike, NaiveDate, Utc};
use tauri::State;
use uuid::Uuid;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/// Return (first_day, last_day) strings in "YYYY-MM-DD" for the given "YYYY-MM" month string.
fn month_boundaries(month: &str) -> Result<(String, String), String> {
    let parts: Vec<&str> = month.split('-').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid month format '{}', expected YYYY-MM", month));
    }
    let year: i32 = parts[0].parse().map_err(|_| format!("Invalid year in '{}'", month))?;
    let mon: u32 = parts[1].parse().map_err(|_| format!("Invalid month in '{}'", month))?;
    if mon < 1 || mon > 12 {
        return Err(format!("Month value {} out of range", mon));
    }
    let first = NaiveDate::from_ymd_opt(year, mon, 1)
        .ok_or_else(|| format!("Invalid date for {}", month))?;
    // Last day: first day of next month minus one day
    let (next_year, next_mon) = if mon == 12 { (year + 1, 1) } else { (year, mon + 1) };
    let last = NaiveDate::from_ymd_opt(next_year, next_mon, 1)
        .ok_or_else(|| "Invalid next month".to_string())?
        .pred_opt()
        .ok_or_else(|| "pred_opt failed".to_string())?;
    Ok((first.format("%Y-%m-%d").to_string(), last.format("%Y-%m-%d").to_string()))
}

/// Compute spending for a category within a date range (returns cents, always positive).
/// Excludes transfer and income categories by design — caller is responsible for only
/// passing spending category_ids.
fn spending_for_category(
    conn: &rusqlite::Connection,
    category_id: &str,
    first: &str,
    last: &str,
) -> Result<i64, String> {
    conn.query_row(
        "SELECT COALESCE(SUM(ABS(amount_cents)), 0)
         FROM transactions
         WHERE category_id = ?1
           AND date >= ?2
           AND date <= ?3
           AND amount_cents < 0",
        rusqlite::params![category_id, first, last],
        |row| row.get::<_, i64>(0),
    )
    .map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────
// Budget CRUD
// ─────────────────────────────────────────────

#[tauri::command]
pub fn get_budgets(state: State<'_, DbState>) -> Result<Vec<BudgetWithSpending>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let now = Utc::now().naive_utc().date();
    let first = NaiveDate::from_ymd_opt(now.year(), now.month(), 1)
        .ok_or("Invalid current date")?;
    let (next_year, next_mon) = if now.month() == 12 {
        (now.year() + 1, 1u32)
    } else {
        (now.year(), now.month() + 1)
    };
    let last = NaiveDate::from_ymd_opt(next_year, next_mon, 1)
        .ok_or("Invalid next month")?
        .pred_opt()
        .ok_or("pred_opt failed")?;
    let first_str = first.format("%Y-%m-%d").to_string();
    let last_str = last.format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.category_id, c.name, c.color, b.monthly_limit_cents,
                    b.is_active, b.created_at
             FROM budgets b
             JOIN categories c ON b.category_id = c.id
             WHERE b.is_active = 1
             ORDER BY c.name",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<Budget> = stmt
        .query_map([], |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                category_color: row.get(3)?,
                monthly_limit_cents: row.get(4)?,
                is_active: row.get::<_, i64>(5)? != 0,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse budget row: {}", e);
                None
            }
        })
        .collect();

    let mut results = Vec::with_capacity(rows.len());
    for budget in rows {
        let spent_cents = spending_for_category(&conn, &budget.category_id, &first_str, &last_str)?;
        let remaining_cents = budget.monthly_limit_cents - spent_cents;
        let percentage = if budget.monthly_limit_cents > 0 {
            spent_cents as f64 / budget.monthly_limit_cents as f64 * 100.0
        } else {
            0.0
        };
        results.push(BudgetWithSpending {
            budget,
            spent_cents,
            remaining_cents,
            percentage,
        });
    }

    Ok(results)
}

#[tauri::command]
pub fn set_budget(
    state: State<'_, DbState>,
    category_id: String,
    monthly_limit_cents: i64,
) -> Result<Budget, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Check if an active budget already exists for this category
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM budgets WHERE category_id = ?1 AND is_active = 1",
            [&category_id],
            |row| row.get(0),
        )
        .ok();

    let (id, created_at) = if let Some(existing_id) = existing {
        conn.execute(
            "UPDATE budgets SET monthly_limit_cents = ?1 WHERE id = ?2",
            rusqlite::params![monthly_limit_cents, existing_id],
        )
        .map_err(|e| e.to_string())?;

        let cat: String = conn
            .query_row("SELECT created_at FROM budgets WHERE id = ?1", [&existing_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        (existing_id, cat)
    } else {
        let new_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO budgets (id, category_id, monthly_limit_cents, is_active) VALUES (?1, ?2, ?3, 1)",
            rusqlite::params![new_id, category_id, monthly_limit_cents],
        )
        .map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        (new_id, now)
    };

    // Fetch category info for the response
    let (cat_name, cat_color): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT name, color FROM categories WHERE id = ?1",
            [&category_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    Ok(Budget {
        id,
        category_id,
        category_name: cat_name,
        category_color: cat_color,
        monthly_limit_cents,
        is_active: true,
        created_at,
    })
}

#[tauri::command]
pub fn delete_budget(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM budgets WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Budget not found: {}", id));
    }
    Ok(())
}

// ─────────────────────────────────────────────
// Budget Status for a given month
// ─────────────────────────────────────────────

#[tauri::command]
pub fn get_budget_status(state: State<'_, DbState>, month: String) -> Result<BudgetStatus, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let (first_str, last_str) = month_boundaries(&month)?;

    // Income for the month: positive amounts in checking accounts from 'cat-income' category
    let income_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_cents), 0)
             FROM transactions
             WHERE category_id = 'cat-income'
               AND date >= ?1
               AND date <= ?2
               AND amount_cents > 0",
            rusqlite::params![first_str, last_str],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Total spending for the month (all non-transfer, non-income, negative amounts)
    let total_spending_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(ABS(amount_cents)), 0)
             FROM transactions
             WHERE category_id NOT IN ('cat-transfer', 'cat-income')
               AND date >= ?1
               AND date <= ?2
               AND amount_cents < 0",
            rusqlite::params![first_str, last_str],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Load active budgets with spending
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.category_id, c.name, c.color, b.monthly_limit_cents,
                    b.is_active, b.created_at
             FROM budgets b
             JOIN categories c ON b.category_id = c.id
             WHERE b.is_active = 1",
        )
        .map_err(|e| e.to_string())?;

    let budget_rows: Vec<Budget> = stmt
        .query_map([], |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                category_color: row.get(3)?,
                monthly_limit_cents: row.get(4)?,
                is_active: row.get::<_, i64>(5)? != 0,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse budget row: {}", e);
                None
            }
        })
        .collect();

    let mut budgets_with_spending = Vec::with_capacity(budget_rows.len());
    let mut total_budgeted_cents: i64 = 0;
    let mut budgeted_spent_cents: i64 = 0;

    for budget in budget_rows {
        let spent_cents = spending_for_category(&conn, &budget.category_id, &first_str, &last_str)?;
        let remaining_cents = budget.monthly_limit_cents - spent_cents;
        let percentage = if budget.monthly_limit_cents > 0 {
            spent_cents as f64 / budget.monthly_limit_cents as f64 * 100.0
        } else {
            0.0
        };
        total_budgeted_cents += budget.monthly_limit_cents;
        budgeted_spent_cents += spent_cents;
        budgets_with_spending.push(BudgetWithSpending {
            budget,
            spent_cents,
            remaining_cents,
            percentage,
        });
    }

    let unbudgeted_spending_cents = total_spending_cents.saturating_sub(budgeted_spent_cents);

    let savings_rate = if income_cents > 0 {
        let net = income_cents - total_spending_cents;
        net as f64 / income_cents as f64
    } else {
        0.0
    };

    Ok(BudgetStatus {
        budgets: budgets_with_spending,
        total_budgeted: total_budgeted_cents as f64 / 100.0,
        total_spent: total_spending_cents as f64 / 100.0,
        unbudgeted_spending: unbudgeted_spending_cents as f64 / 100.0,
        savings_rate,
        income: income_cents as f64 / 100.0,
    })
}

// ─────────────────────────────────────────────
// Savings rate history
// ─────────────────────────────────────────────

#[tauri::command]
pub fn get_savings_rate_history(
    state: State<'_, DbState>,
    months: i32,
) -> Result<Vec<SavingsRatePoint>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().naive_utc().date();
    let mut results = Vec::with_capacity(months as usize);

    for i in (0..months).rev() {
        // Walk backwards from current month
        let year = now.year();
        let mon = now.month() as i32;
        let total_months = year * 12 + mon - 1 - i;
        let target_year = total_months / 12;
        let target_mon = (total_months % 12 + 1) as u32;

        let month_str = format!("{:04}-{:02}", target_year, target_mon);
        let (first_str, last_str) = month_boundaries(&month_str)?;

        let income_cents: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount_cents), 0)
                 FROM transactions
                 WHERE category_id = 'cat-income'
                   AND date >= ?1
                   AND date <= ?2
                   AND amount_cents > 0",
                rusqlite::params![first_str, last_str],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let spending_cents: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(ABS(amount_cents)), 0)
                 FROM transactions
                 WHERE category_id NOT IN ('cat-transfer', 'cat-income')
                   AND date >= ?1
                   AND date <= ?2
                   AND amount_cents < 0",
                rusqlite::params![first_str, last_str],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let savings_rate = if income_cents > 0 {
            (income_cents - spending_cents) as f64 / income_cents as f64
        } else {
            0.0
        };

        results.push(SavingsRatePoint {
            month: month_str,
            income: income_cents as f64 / 100.0,
            spending: spending_cents as f64 / 100.0,
            savings_rate,
        });
    }

    Ok(results)
}

// ─────────────────────────────────────────────
// Budget suggestions
// ─────────────────────────────────────────────

#[tauri::command]
pub fn suggest_budgets(state: State<'_, DbState>) -> Result<Vec<BudgetWithSpending>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().naive_utc().date();

    // Compute the first day 3 months ago and last day of last month
    let year = now.year();
    let mon = now.month() as i32;

    // Three-month window: start of 3 months ago -> end of last month
    let start_total = year * 12 + mon - 1 - 3;
    let start_year = start_total / 12;
    let start_mon = (start_total % 12 + 1) as u32;
    let start_date = NaiveDate::from_ymd_opt(start_year, start_mon, 1)
        .ok_or("Invalid start date for suggestions")?
        .format("%Y-%m-%d")
        .to_string();

    // End: last day of previous month = first day of current month - 1 day
    let end_date = NaiveDate::from_ymd_opt(year, now.month(), 1)
        .ok_or("Invalid current month")?
        .pred_opt()
        .ok_or("pred_opt failed")?
        .format("%Y-%m-%d")
        .to_string();

    // Aggregate 3-month spending by category (exclude transfer and income)
    let mut stmt = conn
        .prepare(
            "SELECT t.category_id, c.name, c.color,
                    COALESCE(SUM(ABS(t.amount_cents)), 0) AS total
             FROM transactions t
             JOIN categories c ON t.category_id = c.id
             WHERE t.category_id NOT IN ('cat-transfer', 'cat-income')
               AND t.date >= ?1
               AND t.date <= ?2
               AND t.amount_cents < 0
             GROUP BY t.category_id, c.name, c.color
             ORDER BY c.name",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, Option<String>, i64)> = stmt
        .query_map(rusqlite::params![start_date, end_date], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse suggestion row: {}", e);
                None
            }
        })
        .collect();

    let mut suggestions = Vec::with_capacity(rows.len());
    for (category_id, category_name, category_color, total_cents) in rows {
        // 3-month average
        let avg_cents = total_cents / 3;
        // Round to nearest $10 (1000 cents)
        let suggested_limit_cents = ((avg_cents + 500) / 1000) * 1000;

        let budget = Budget {
            id: String::new(), // Not persisted — suggestions only
            category_id,
            category_name: Some(category_name),
            category_color,
            monthly_limit_cents: suggested_limit_cents,
            is_active: false,
            created_at: String::new(),
        };

        suggestions.push(BudgetWithSpending {
            spent_cents: avg_cents,
            remaining_cents: suggested_limit_cents - avg_cents,
            percentage: if suggested_limit_cents > 0 {
                avg_cents as f64 / suggested_limit_cents as f64 * 100.0
            } else {
                0.0
            },
            budget,
        });
    }

    Ok(suggestions)
}
