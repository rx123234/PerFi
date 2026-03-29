mod categorize;
mod commands;
mod db;
mod import;
mod models;

use db::DbState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let db_path = db::get_db_path(&app.handle())
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            let conn = db::initialize(&db_path)
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            app.manage(DbState(Mutex::new(conn)));
            eprintln!("PerFi database initialized at {:?}", db_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Accounts
            commands::accounts::get_accounts,
            commands::accounts::create_account,
            commands::accounts::update_account,
            commands::accounts::delete_account,
            // Transactions
            commands::transactions::get_transactions,
            commands::transactions::update_transaction_category,
            commands::transactions::get_transaction_count,
            // Categories
            commands::categories::get_categories,
            commands::categories::create_category,
            commands::categories::update_category,
            commands::categories::delete_category,
            commands::categories::get_category_rules,
            commands::categories::create_category_rule,
            commands::categories::delete_category_rule,
            // Dashboard
            commands::dashboard::get_cash_flow_summary,
            commands::dashboard::get_spending_by_category,
            commands::dashboard::get_spending_trends,
            commands::dashboard::get_sankey_data,
            commands::dashboard::get_top_merchants,
            commands::dashboard::get_account_balances,
            // Plaid
            commands::plaid::save_plaid_credentials,
            commands::plaid::get_plaid_credentials,
            commands::plaid::create_link_token,
            commands::plaid::exchange_public_token,
            commands::plaid::sync_transactions,
            commands::plaid::sync_all_accounts,
            // Import
            commands::import::get_csv_formats,
            commands::import::preview_csv,
            commands::import::import_csv,
            commands::import::recategorize_transactions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
