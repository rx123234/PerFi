mod categorize;
mod commands;
mod db;
mod import;
mod models;
mod planning;

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
            commands::dashboard::get_spending_breakdown,
            commands::dashboard::get_fixed_costs,
            // Teller
            commands::teller::save_teller_config,
            commands::teller::get_teller_config,
            commands::teller::teller_connect_success,
            commands::teller::sync_transactions,
            commands::teller::sync_all_accounts,
            commands::teller::sync_balances_only,
            // Import
            commands::import::get_csv_formats,
            commands::import::preview_csv,
            commands::import::import_csv,
            commands::import::recategorize_transactions,
            // Net Worth
            commands::net_worth::get_assets,
            commands::net_worth::create_asset,
            commands::net_worth::update_asset,
            commands::net_worth::delete_asset,
            commands::net_worth::get_liabilities,
            commands::net_worth::create_liability,
            commands::net_worth::update_liability,
            commands::net_worth::delete_liability,
            commands::net_worth::get_net_worth_summary,
            commands::net_worth::get_net_worth_history,
            commands::net_worth::take_net_worth_snapshot,
            commands::net_worth::sync_asset_from_account,
            // Budgets
            commands::budgets::get_budgets,
            commands::budgets::set_budget,
            commands::budgets::delete_budget,
            commands::budgets::get_budget_status,
            commands::budgets::get_savings_rate_history,
            commands::budgets::suggest_budgets,
            // Goals
            commands::goals::get_goals,
            commands::goals::create_goal,
            commands::goals::update_goal,
            commands::goals::delete_goal,
            commands::goals::update_goal_progress,
            commands::goals::get_emergency_fund_target,
            // Retirement
            commands::retirement::get_retirement_profile,
            commands::retirement::get_retirement_profile_state,
            commands::retirement::save_retirement_profile,
            commands::retirement::run_retirement_projection,
            commands::retirement::get_required_savings_rate,
            commands::retirement::get_ss_comparison,
            commands::retirement::save_retirement_scenario,
            commands::retirement::get_retirement_scenarios,
            // Insights
            commands::insights::get_insights,
            commands::insights::dismiss_insight,
            commands::insights::mark_insight_read,
            commands::insights::generate_insights,
            commands::insights::get_insight_data_for_ai,
            // Investment Import
            commands::investment_import::preview_investment_csv,
            commands::investment_import::import_investment_csv,
            // Forecasting
            commands::forecasting::get_cash_flow_forecast,
            commands::forecasting::get_upcoming_bills,
            commands::forecasting::get_seasonal_patterns,
            commands::forecasting::calculate_debt_payoff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
