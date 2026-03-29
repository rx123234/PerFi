use crate::categorize::rules;
use crate::db::DbState;
use crate::import::csv_parser;
use crate::models::ImportResult;
use std::path::Path;
use tauri::State;
use uuid::Uuid;

/// Validate that the file path looks like a CSV file and exists.
fn validate_csv_path(file_path: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("csv") || ext.eq_ignore_ascii_case("tsv") => Ok(()),
        _ => Err("Only .csv and .tsv files are supported".to_string()),
    }
}

#[tauri::command]
pub fn get_csv_formats() -> Vec<csv_parser::CsvFormat> {
    csv_parser::get_csv_formats()
}

#[tauri::command]
pub fn preview_csv(
    file_path: String,
    format_name: String,
    account_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    validate_csv_path(&file_path)?;
    let formats = csv_parser::get_csv_formats();
    let format = formats
        .iter()
        .find(|f| f.name == format_name)
        .ok_or_else(|| format!("Unknown format: {}", format_name))?;

    let result = csv_parser::parse_csv(&file_path, format, &account_id)?;

    let preview: Vec<serde_json::Value> = result
        .transactions
        .iter()
        .take(10)
        .map(|tx| {
            serde_json::json!({
                "date": tx.date,
                "amount": tx.amount_cents as f64 / 100.0,
                "description": tx.description,
            })
        })
        .collect();

    Ok(preview)
}

#[tauri::command]
pub fn import_csv(
    state: State<'_, DbState>,
    file_path: String,
    account_id: String,
    format_name: String,
) -> Result<ImportResult, String> {
    validate_csv_path(&file_path)?;
    let formats = csv_parser::get_csv_formats();
    let format = formats
        .iter()
        .find(|f| f.name == format_name)
        .ok_or_else(|| format!("Unknown format: {}", format_name))?;

    let parse_result = csv_parser::parse_csv(&file_path, format, &account_id)?;
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut imported = 0;
    let mut duplicates = 0;
    let mut categorized = 0;
    let mut errors: Vec<String> = parse_result.warnings; // Carry over parse warnings

    // Load categorization rules once for the entire batch
    let cat_rules = rules::load_rules(&conn);

    // Wrap all inserts in a transaction for performance and atomicity
    conn.execute_batch("BEGIN TRANSACTION").map_err(|e| e.to_string())?;

    for tx in &parse_result.transactions {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM transactions WHERE import_hash = ?1",
                [&tx.import_hash],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if exists {
            duplicates += 1;
            continue;
        }

        let id = Uuid::new_v4().to_string();
        let category_id = rules::categorize_with_rules(&cat_rules, &tx.description, &None);

        match conn.execute(
            "INSERT INTO transactions (id, account_id, date, amount_cents, description, import_hash, category_id, source, pending)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'csv', 0)",
            rusqlite::params![
                id,
                account_id,
                tx.date,
                tx.amount_cents,
                tx.description,
                tx.import_hash,
                category_id,
            ],
        ) {
            Ok(_) => {
                imported += 1;
                if category_id.is_some() {
                    categorized += 1;
                }
            }
            Err(e) => {
                errors.push(format!("Insert error: {}", e));
            }
        }
    }

    conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;

    Ok(ImportResult {
        imported,
        duplicates,
        categorized,
        errors,
    })
}

#[tauri::command]
pub fn recategorize_transactions(state: State<'_, DbState>) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::categorize::rules::recategorize_all(&conn)
}
