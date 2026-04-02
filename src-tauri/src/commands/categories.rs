use crate::db::DbState;
use crate::models::{Category, CategoryRule};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_categories(state: State<'_, DbState>) -> Result<Vec<Category>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, parent_id, color, icon, exclude_from_planning FROM categories ORDER BY name")
        .map_err(|e| e.to_string())?;

    let categories = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                color: row.get(3)?,
                icon: row.get(4)?,
                exclude_from_planning: row.get::<_, i32>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse row: {}", e); None }
        })
        .collect();

    Ok(categories)
}

#[tauri::command]
pub fn create_category(
    state: State<'_, DbState>,
    name: String,
    color: Option<String>,
    parent_id: Option<String>,
) -> Result<Category, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Category name cannot be empty".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO categories (id, name, parent_id, color) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, name, parent_id, color],
    )
    .map_err(|e| e.to_string())?;

    Ok(Category {
        id,
        name,
        parent_id,
        color,
        icon: None,
        exclude_from_planning: false,
    })
}

#[tauri::command]
pub fn update_category(
    state: State<'_, DbState>,
    id: String,
    name: String,
    color: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE categories SET name = ?1, color = ?2 WHERE id = ?3",
        rusqlite::params![name, color, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_category(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| e.to_string())?;
    let result = (|| {
        conn.execute(
            "UPDATE transactions SET category_id = NULL WHERE category_id = ?1",
            [&id],
        )?;
        conn.execute("DELETE FROM category_rules WHERE category_id = ?1", [&id])?;
        conn.execute("DELETE FROM categories WHERE id = ?1", [&id])?;
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
pub fn update_category_planning_exclusion(
    state: State<'_, DbState>,
    category_id: String,
    exclude_from_planning: bool,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute(
            "UPDATE categories SET exclude_from_planning = ?1 WHERE id = ?2",
            rusqlite::params![exclude_from_planning as i32, category_id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err("Category not found".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn get_category_rules(state: State<'_, DbState>) -> Result<Vec<CategoryRule>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT cr.id, cr.pattern, cr.category_id, c.name, cr.priority
             FROM category_rules cr
             LEFT JOIN categories c ON cr.category_id = c.id
             ORDER BY cr.priority DESC",
        )
        .map_err(|e| e.to_string())?;

    let rules = stmt
        .query_map([], |row| {
            Ok(CategoryRule {
                id: row.get(0)?,
                pattern: row.get(1)?,
                category_id: row.get(2)?,
                category_name: row.get(3)?,
                priority: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to parse row: {}", e); None }
        })
        .collect();

    Ok(rules)
}

#[tauri::command]
pub fn create_category_rule(
    state: State<'_, DbState>,
    pattern: String,
    category_id: String,
    priority: i32,
) -> Result<CategoryRule, String> {
    let pattern = pattern.trim().to_string();
    if pattern.is_empty() {
        return Err("Pattern cannot be empty".to_string());
    }
    if pattern.len() > 255 {
        return Err("Pattern must be 255 characters or fewer".to_string());
    }
    if category_id.trim().is_empty() {
        return Err("Category ID cannot be empty".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO category_rules (id, pattern, category_id, priority) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, pattern, category_id, priority],
    )
    .map_err(|e| e.to_string())?;

    let category_name: Option<String> = conn
        .query_row(
            "SELECT name FROM categories WHERE id = ?1",
            [&category_id],
            |row| row.get(0),
        )
        .ok();

    Ok(CategoryRule {
        id,
        pattern,
        category_id,
        category_name,
        priority,
    })
}

#[tauri::command]
pub fn delete_category_rule(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM category_rules WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
