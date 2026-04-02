use crate::db::{DbState, StorageState};
use crate::models::StorageInfo;
use chrono::{Datelike, Duration, NaiveDate, Utc};
use tauri::State;

#[tauri::command]
pub fn get_storage_info(storage: State<'_, StorageState>) -> Result<StorageInfo, String> {
    Ok(storage.0.clone())
}

#[tauri::command]
pub fn seed_demo_data(
    state: State<'_, DbState>,
    storage: State<'_, StorageState>,
) -> Result<(), String> {
    if storage.0.is_default_profile {
        return Err("Demo data seeding is blocked on the default profile. Launch PerFi with --profile screenshots first.".to_string());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), rusqlite::Error> {
        conn.execute_batch(
            "DELETE FROM amazon_orders;
             DELETE FROM costco_items;
             DELETE FROM insights;
             DELETE FROM retirement_scenarios;
             DELETE FROM retirement_profile;
             DELETE FROM goals;
             DELETE FROM budgets;
             DELETE FROM net_worth_snapshots;
             DELETE FROM liabilities;
             DELETE FROM assets;
             DELETE FROM transactions;
             DELETE FROM teller_config;
             DELETE FROM accounts;",
        )?;

        let checking_id = "demo-checking";
        let savings_id = "demo-savings";
        let credit_id = "demo-credit";

        conn.execute(
            "INSERT INTO accounts (
                id, name, institution, account_type, mask, source, balance_cents, balance_available_cents, balance_updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, 'manual', ?6, ?6, datetime('now'))",
            rusqlite::params![checking_id, "Everyday Checking", "Northstar Bank", "checking", "1842", 1_242_500i64],
        )?;
        conn.execute(
            "INSERT INTO accounts (
                id, name, institution, account_type, mask, source, balance_cents, balance_available_cents, balance_updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, 'manual', ?6, ?6, datetime('now'))",
            rusqlite::params![savings_id, "Emergency Savings", "Northstar Bank", "savings", "7721", 3_860_000i64],
        )?;
        conn.execute(
            "INSERT INTO accounts (
                id, name, institution, account_type, mask, source, balance_cents, balance_available_cents, balance_updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, 'manual', ?6, ?6, datetime('now'))",
            rusqlite::params![credit_id, "Travel Rewards Visa", "Summit Card", "credit_card", "4021", 186_400i64],
        )?;

        conn.execute(
            "INSERT INTO budgets (id, category_id, monthly_limit_cents, is_active)
             VALUES
             ('budget-groceries', 'cat-groceries', 85000, 1),
             ('budget-dining', 'cat-dining', 42000, 1),
             ('budget-shopping', 'cat-shopping', 35000, 1),
             ('budget-subscriptions', 'cat-subscriptions', 11000, 1),
             ('budget-utilities', 'cat-utilities', 30000, 1),
             ('budget-entertainment', 'cat-entertainment', 18000, 1)",
            [],
        )?;

        conn.execute(
            "INSERT INTO assets (
                id, name, asset_type, institution, current_value_cents, ticker, shares, cost_basis_cents,
                tax_treatment, contribution_ytd_cents, contribution_limit_cents, notes, is_manual, linked_account_id
             ) VALUES
             ('asset-401k', '401(k)', 'retirement', 'Fidelity', 18650000, 'VTI', 182.4, 14200000, 'traditional', 920000, 2300000, 'Employer plan', 1, NULL),
             ('asset-brokerage', 'Brokerage', 'investment', 'Vanguard', 8240000, 'VTI', 74.8, 6930000, 'taxable', 0, NULL, 'Taxable investing account', 1, NULL),
             ('asset-home', 'Primary Residence', 'real_estate', NULL, 64500000, NULL, NULL, 50200000, NULL, 0, NULL, 'Conservative estimate for screenshots', 1, NULL)",
            [],
        )?;

        conn.execute(
            "INSERT INTO liabilities (
                id, name, liability_type, institution, current_balance_cents, original_balance_cents,
                interest_rate, minimum_payment_cents, monthly_payment_cents, payment_day, maturity_date, notes
             ) VALUES
             ('liability-mortgage', 'Mortgage', 'mortgage', 'Northstar Bank', 39200000, 46500000, 0.0575, 285000, 285000, 1, '2051-07-01', '30-year fixed'),
             ('liability-student', 'Student Loans', 'student_loan', 'AidServ', 4800000, 8600000, 0.0425, 42500, 64000, 11, '2033-05-01', 'Refinanced federal loans')",
            [],
        )?;

        conn.execute(
            "INSERT INTO goals (
                id, name, goal_type, target_cents, current_cents, monthly_contribution_cents, target_date, priority, icon, color, notes, status
             ) VALUES
             ('goal-emergency', 'Emergency Fund', 'cash_reserve', 4500000, 3860000, 35000, '2026-09-01', 1, 'shield', '#1d4ed8', 'Keep six months of core expenses in cash.', 'active'),
             ('goal-kitchen', 'Kitchen Remodel', 'sinking_fund', 2200000, 840000, 65000, '2027-04-01', 2, 'home', '#ea580c', 'Targeting a modest remodel next spring.', 'active'),
             ('goal-roth', 'Roth IRA', 'retirement', 700000, 280000, 35000, '2026-12-31', 1, 'sparkles', '#16a34a', 'Annual contribution goal.', 'active')",
            [],
        )?;

        conn.execute(
            "INSERT OR REPLACE INTO retirement_profile (
                id, current_age, retirement_age, life_expectancy, annual_income_cents, income_growth_rate,
                ss_monthly_benefit_cents, ss_claiming_age, retirement_spending_rate, inflation_rate,
                pre_retirement_return, post_retirement_return, withdrawal_rate, effective_tax_rate, state, filing_status
             ) VALUES (
                'default', 37, 60, 92, 19600000, 0.035, 320000, 67, 0.78, 0.028,
                0.07, 0.05, 0.04, 0.23, 'California', 'married_joint'
             )",
            [],
        )?;

        conn.execute(
            "INSERT INTO retirement_scenarios (id, name, description, overrides_json, result_json)
             VALUES
             ('scenario-base', 'Base Plan', 'Current savings pace with moderate returns.', '{\"extraAnnualSavingsCents\":0}', NULL),
             ('scenario-coast', 'Coast FIRE', 'Dial down contributions after age 45.', '{\"retirementAge\":58,\"extraAnnualSavingsCents\":-1800000}', NULL)",
            [],
        )?;

        let today = Utc::now().date_naive();
        let mut salary_counter = 0;
        for months_back in (0..15).rev() {
            let month_anchor = shift_month(today, -(months_back as i32));
            let year = month_anchor.year();
            let month = month_anchor.month();
            let seasonal: f64 = match month {
                11 | 12 => 1.18,
                6 | 7 => 1.08,
                1 | 2 => 0.95,
                _ => 1.0,
            };
            let groceries = (74_000.0 * seasonal).round() as i64;
            let dining = (28_000.0 * seasonal).round() as i64;
            let shopping = (18_000.0 * seasonal).round() as i64;
            let entertainment = (13_000.0 * seasonal).round() as i64;

            insert_tx(
                &conn,
                &format!("tx-payroll-{}-a", month_anchor.format("%Y%m")),
                checking_id,
                safe_date(year, month, 1),
                490_000,
                "PAYROLL NORTHSTAR",
                Some("Northstar Payroll"),
                Some("cat-income"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-payroll-{}-b", month_anchor.format("%Y%m")),
                checking_id,
                safe_date(year, month, 15),
                490_000 + if month % 3 == 0 { 18_000 } else { 0 },
                "PAYROLL NORTHSTAR",
                Some("Northstar Payroll"),
                Some("cat-income"),
                "manual",
                false,
                false,
            )?;
            salary_counter += 1;

            insert_tx(
                &conn,
                &format!("tx-rent-{}", month_anchor.format("%Y%m")),
                checking_id,
                safe_date(year, month, 2),
                -268_000,
                "PACIFIC HOA + MORTGAGE",
                Some("Pacific Home Loan"),
                Some("cat-housing"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-utility-{}", month_anchor.format("%Y%m")),
                checking_id,
                safe_date(year, month, 6),
                -24_500 - ((month as i64 % 4) * 1_800),
                "PACIFIC GAS & ELECTRIC",
                Some("PG&E"),
                Some("cat-utilities"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-savings-{}", month_anchor.format("%Y%m")),
                checking_id,
                safe_date(year, month, 5),
                -65_000,
                "TRANSFER TO EMERGENCY SAVINGS",
                Some("Internal Transfer"),
                Some("cat-transfer"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-savings-deposit-{}", month_anchor.format("%Y%m")),
                savings_id,
                safe_date(year, month, 5),
                65_000,
                "TRANSFER FROM CHECKING",
                Some("Internal Transfer"),
                Some("cat-transfer"),
                "manual",
                false,
                false,
            )?;

            insert_tx(
                &conn,
                &format!("tx-groceries-a-{}", month_anchor.format("%Y%m")),
                credit_id,
                safe_date(year, month, 4),
                groceries / 2,
                "WHOLE FOODS MARKET",
                Some("Whole Foods"),
                Some("cat-groceries"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-groceries-b-{}", month_anchor.format("%Y%m")),
                credit_id,
                safe_date(year, month, 18),
                groceries / 2,
                "TRADER JOE'S",
                Some("Trader Joe's"),
                Some("cat-groceries"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-dining-{}", month_anchor.format("%Y%m")),
                credit_id,
                safe_date(year, month, 9),
                dining,
                "SWEETGREEN",
                Some("Sweetgreen"),
                Some("cat-dining"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-shopping-{}", month_anchor.format("%Y%m")),
                credit_id,
                safe_date(year, month, 21),
                shopping,
                "AMAZON MARKETPLACE",
                Some("Amazon"),
                Some("cat-shopping"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-entertainment-{}", month_anchor.format("%Y%m")),
                credit_id,
                safe_date(year, month, 24),
                entertainment,
                "AMC THEATRES",
                Some("AMC"),
                Some("cat-entertainment"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-phone-{}", month_anchor.format("%Y%m")),
                credit_id,
                safe_date(year, month, 12),
                9_500,
                "VERIZON WIRELESS",
                Some("Verizon"),
                Some("cat-utilities"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-netflix-{}", month_anchor.format("%Y%m")),
                credit_id,
                safe_date(year, month, 14),
                1_999,
                "NETFLIX.COM",
                Some("Netflix"),
                Some("cat-subscriptions"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-spotify-{}", month_anchor.format("%Y%m")),
                credit_id,
                safe_date(year, month, 16),
                1_099,
                "SPOTIFY USA",
                Some("Spotify"),
                Some("cat-subscriptions"),
                "manual",
                false,
                false,
            )?;
            insert_tx(
                &conn,
                &format!("tx-credit-payment-{}", month_anchor.format("%Y%m")),
                checking_id,
                safe_date(year, month, 27),
                -(groceries + dining + shopping + entertainment + 12_598),
                "CARD PAYMENT SUMMIT VISA",
                Some("Summit Card"),
                Some("cat-transfer"),
                "manual",
                false,
                false,
            )?;

            if month == 12 {
                insert_tx(
                    &conn,
                    &format!("tx-bonus-{}", year),
                    checking_id,
                    safe_date(year, month, 20),
                    225_000,
                    "ANNUAL BONUS",
                    Some("Northstar Payroll"),
                    Some("cat-income"),
                    "manual",
                    false,
                    true,
                )?;
            }

            if month == 3 {
                insert_tx(
                    &conn,
                    &format!("tx-tax-{}", year),
                    checking_id,
                    safe_date(year, month, 28),
                    -182_000,
                    "IRS TAX PAYMENT",
                    Some("IRS"),
                    Some("cat-transfer"),
                    "manual",
                    false,
                    true,
                )?;
            }
        }

        for months_back in (0..12).rev() {
            let month_anchor = shift_month(today, -(months_back as i32));
            let total_assets = 82_500_000 + (11 - months_back as i64) * 185_000;
            let total_liabilities = 45_300_000 - (11 - months_back as i64) * 122_000;
            let net = total_assets - total_liabilities;
            conn.execute(
                "INSERT INTO net_worth_snapshots (
                    id, snapshot_date, total_assets_cents, total_liabilities_cents, net_worth_cents, breakdown_json
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    format!("snapshot-{}", month_anchor.format("%Y%m")),
                    safe_date(month_anchor.year(), month_anchor.month(), 1),
                    total_assets,
                    total_liabilities,
                    net,
                    Some(format!("{{\"cash\":{},\"investments\":{},\"real_estate\":{},\"mortgage\":{},\"student_loans\":{}}}",
                        5_102_500,
                        26_890_000,
                        64_500_000,
                        39_200_000,
                        4_800_000
                    )),
                ],
            )?;
        }

        conn.execute(
            "INSERT INTO insights (id, insight_type, title, body, severity, data_json, is_read, is_dismissed, created_at)
             VALUES
             ('insight-1', 'spending', 'Dining spend is running hot', 'Dining is 24% above your 3-month baseline, mostly from delivery and weekday lunches.', 'warning', NULL, 0, 0, datetime('now', '-2 days')),
             ('insight-2', 'savings', 'Emergency fund is almost full', 'You are at 86% of your emergency-fund target. One more quarter of current transfers gets you over the line.', 'success', NULL, 0, 0, datetime('now', '-5 days')),
             ('insight-3', 'milestone', 'Net worth crossed $430k', 'Assets continued to climb while liabilities kept falling. This is a meaningful momentum milestone.', 'success', NULL, 1, 0, datetime('now', '-12 days'))",
            [],
        )?;

        if salary_counter == 0 {
            return Err(rusqlite::Error::InvalidQuery);
        }

        Ok(())
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

fn insert_tx(
    conn: &rusqlite::Connection,
    id: &str,
    account_id: &str,
    date: String,
    amount_cents: i64,
    description: &str,
    merchant: Option<&str>,
    category_id: Option<&str>,
    source: &str,
    pending: bool,
    exclude_from_planning: bool,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO transactions (
            id, account_id, date, amount_cents, description, enriched_desc, category_id, merchant, source, pending, exclude_from_planning
         ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            id,
            account_id,
            date,
            amount_cents,
            description,
            category_id,
            merchant,
            source,
            pending as i32,
            exclude_from_planning as i32
        ],
    )?;
    Ok(())
}

fn shift_month(date: NaiveDate, offset_months: i32) -> NaiveDate {
    let mut year = date.year();
    let mut month = date.month() as i32 + offset_months;
    while month <= 0 {
        month += 12;
        year -= 1;
    }
    while month > 12 {
        month -= 12;
        year += 1;
    }

    let day = date.day().min(days_in_month(year, month as u32));
    NaiveDate::from_ymd_opt(year, month as u32, day).expect("valid shifted date")
}

fn safe_date(year: i32, month: u32, day: u32) -> String {
    let clamped_day = day.min(days_in_month(year, month));
    NaiveDate::from_ymd_opt(year, month, clamped_day)
        .expect("valid demo date")
        .format("%Y-%m-%d")
        .to_string()
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let next_month = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).expect("valid next month")
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1).expect("valid next month")
    };
    (next_month - Duration::days(1)).day()
}
