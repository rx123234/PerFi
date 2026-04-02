use crate::db::DbState;
use crate::models::*;
use chrono::{Datelike, Duration, NaiveDate, Utc};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_goals(state: State<'_, DbState>) -> Result<Vec<GoalWithProgress>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, goal_type, target_cents, current_cents, monthly_contribution_cents,
                    target_date, priority, linked_asset_id, icon, color, notes, status,
                    completed_at, created_at
             FROM goals
             WHERE status != 'deleted'
             ORDER BY priority DESC, created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let goals: Vec<Goal> = stmt
        .query_map([], |row| {
            Ok(Goal {
                id: row.get(0)?,
                name: row.get(1)?,
                goal_type: row.get(2)?,
                target_cents: row.get(3)?,
                current_cents: row.get(4)?,
                monthly_contribution_cents: row.get(5)?,
                target_date: row.get(6)?,
                priority: row.get(7)?,
                linked_asset_id: row.get(8)?,
                icon: row.get(9)?,
                color: row.get(10)?,
                notes: row.get(11)?,
                status: row.get(12)?,
                completed_at: row.get(13)?,
                created_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse goal row: {}", e);
                None
            }
        })
        .collect();

    let today = Utc::now().date_naive();

    let result = goals
        .into_iter()
        .map(|goal| {
            let percentage = if goal.target_cents > 0 {
                (goal.current_cents as f64 / goal.target_cents as f64 * 100.0).min(100.0)
            } else {
                0.0
            };

            let remaining_cents = (goal.target_cents - goal.current_cents).max(0);

            let (months_remaining, projected_completion_date) =
                if goal.monthly_contribution_cents > 0 && remaining_cents > 0 {
                    let months =
                        (remaining_cents as f64 / goal.monthly_contribution_cents as f64).ceil()
                            as i32;
                    // Add months_remaining months to today
                    let projected = add_months(today, months);
                    (
                        Some(months),
                        Some(projected.format("%Y-%m-%d").to_string()),
                    )
                } else if remaining_cents == 0 {
                    (Some(0), Some(today.format("%Y-%m-%d").to_string()))
                } else {
                    (None, None)
                };

            let on_track = if let Some(ref target_date_str) = goal.target_date {
                if let Ok(target_date) =
                    NaiveDate::parse_from_str(target_date_str, "%Y-%m-%d")
                {
                    if let Some(ref projected_str) = projected_completion_date {
                        if let Ok(projected) =
                            NaiveDate::parse_from_str(projected_str, "%Y-%m-%d")
                        {
                            projected <= target_date
                        } else {
                            true
                        }
                    } else {
                        // No projection (no contribution) — only on track if already met
                        remaining_cents == 0 || today <= target_date
                    }
                } else {
                    true
                }
            } else {
                true
            };

            GoalWithProgress {
                goal,
                percentage,
                projected_completion_date,
                on_track,
                months_remaining,
            }
        })
        .collect();

    Ok(result)
}

/// Add `months` months to a NaiveDate, clamping to end-of-month as needed.
fn add_months(date: NaiveDate, months: i32) -> NaiveDate {
    let total_months = date.year() as i32 * 12 + date.month() as i32 - 1 + months;
    let year = total_months / 12;
    let month = (total_months % 12 + 1) as u32;
    // Try the same day, then clamp to end of month
    NaiveDate::from_ymd_opt(year, month, date.day())
        .or_else(|| NaiveDate::from_ymd_opt(year, month + 1, 1).map(|d| d - Duration::days(1)))
        .unwrap_or(date)
}

#[tauri::command]
pub fn create_goal(
    state: State<'_, DbState>,
    name: String,
    goal_type: String,
    target_cents: i64,
    current_cents: i64,
    monthly_contribution_cents: i64,
    target_date: Option<String>,
    priority: i32,
    linked_asset_id: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    notes: Option<String>,
) -> Result<Goal, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Goal name cannot be empty".to_string());
    }
    if target_cents <= 0 {
        return Err("Target amount must be greater than zero".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO goals (id, name, goal_type, target_cents, current_cents,
             monthly_contribution_cents, target_date, priority, linked_asset_id, icon, color,
             notes, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'active', ?13)",
        rusqlite::params![
            id,
            name,
            goal_type,
            target_cents,
            current_cents,
            monthly_contribution_cents,
            target_date,
            priority,
            linked_asset_id,
            icon,
            color,
            notes,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Goal {
        id,
        name,
        goal_type,
        target_cents,
        current_cents,
        monthly_contribution_cents,
        target_date,
        priority,
        linked_asset_id,
        icon,
        color,
        notes,
        status: "active".to_string(),
        completed_at: None,
        created_at: now,
    })
}

#[tauri::command]
pub fn update_goal(
    state: State<'_, DbState>,
    id: String,
    name: String,
    goal_type: String,
    target_cents: i64,
    current_cents: i64,
    monthly_contribution_cents: i64,
    target_date: Option<String>,
    priority: i32,
    icon: Option<String>,
    color: Option<String>,
    notes: Option<String>,
    status: String,
) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Goal name cannot be empty".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Fetch current status to detect status change to 'completed'
    let current_status: String = conn
        .query_row(
            "SELECT status FROM goals WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Goal not found: {}", e))?;

    let completing = status == "completed" && current_status != "completed";

    if completing {
        conn.execute(
            "UPDATE goals SET name = ?1, goal_type = ?2, target_cents = ?3, current_cents = ?4,
                 monthly_contribution_cents = ?5, target_date = ?6, priority = ?7, icon = ?8,
                 color = ?9, notes = ?10, status = ?11, completed_at = datetime('now')
             WHERE id = ?12",
            rusqlite::params![
                name,
                goal_type,
                target_cents,
                current_cents,
                monthly_contribution_cents,
                target_date,
                priority,
                icon,
                color,
                notes,
                status,
                id,
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE goals SET name = ?1, goal_type = ?2, target_cents = ?3, current_cents = ?4,
                 monthly_contribution_cents = ?5, target_date = ?6, priority = ?7, icon = ?8,
                 color = ?9, notes = ?10, status = ?11
             WHERE id = ?12",
            rusqlite::params![
                name,
                goal_type,
                target_cents,
                current_cents,
                monthly_contribution_cents,
                target_date,
                priority,
                icon,
                color,
                notes,
                status,
                id,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_goal(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM goals WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Goal not found: {}", id));
    }
    Ok(())
}

#[tauri::command]
pub fn update_goal_progress(
    state: State<'_, DbState>,
    id: String,
    current_cents: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let target_cents: i64 = conn
        .query_row(
            "SELECT target_cents FROM goals WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Goal not found: {}", e))?;

    if current_cents >= target_cents {
        conn.execute(
            "UPDATE goals SET current_cents = ?1, status = 'completed', completed_at = datetime('now')
             WHERE id = ?2",
            rusqlite::params![current_cents, id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE goals SET current_cents = ?1 WHERE id = ?2",
            rusqlite::params![current_cents, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_emergency_fund_target(state: State<'_, DbState>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Sum of spending over last 3 months (negative amount_cents = money out)
    // Exclude transfers
    let three_months_ago = {
        let now = Utc::now().date_naive();
        add_months(now, -3).format("%Y-%m-%d").to_string()
    };

    let total_spending: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(ABS(t.amount_cents)), 0)
             FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             LEFT JOIN categories c ON t.category_id = c.id
             WHERE t.amount_cents < 0
               AND COALESCE(c.name, '') != 'Transfer'
               AND t.category_id NOT IN (
                   SELECT id FROM categories WHERE name = 'Transfer'
               )
               AND t.date >= ?1
               AND t.pending = 0",
            rusqlite::params![three_months_ago],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let monthly_avg = total_spending / 3;
    let target = monthly_avg * 6;

    Ok(target)
}
