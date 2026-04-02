use crate::db::DbState;
use crate::models::*;
use crate::planning::{monte_carlo, projections};
use chrono::{Datelike, Utc};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_retirement_profile(state: State<'_, DbState>) -> Result<RetirementProfile, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT current_age, retirement_age, life_expectancy, annual_income_cents,
                income_growth_rate, ss_monthly_benefit_cents, ss_claiming_age,
                retirement_spending_rate, inflation_rate, pre_retirement_return,
                post_retirement_return, withdrawal_rate, effective_tax_rate,
                state, filing_status
         FROM retirement_profile WHERE id = 'default'",
        [],
        |row| {
            Ok(RetirementProfile {
                current_age: row.get(0)?,
                retirement_age: row.get(1)?,
                life_expectancy: row.get(2)?,
                annual_income_cents: row.get(3)?,
                income_growth_rate: row.get(4)?,
                ss_monthly_benefit_cents: row.get(5)?,
                ss_claiming_age: row.get(6)?,
                retirement_spending_rate: row.get(7)?,
                inflation_rate: row.get(8)?,
                pre_retirement_return: row.get(9)?,
                post_retirement_return: row.get(10)?,
                withdrawal_rate: row.get(11)?,
                effective_tax_rate: row.get(12)?,
                state: row.get(13)?,
                filing_status: row.get(14)?,
            })
        },
    );

    match result {
        Ok(profile) => Ok(profile),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(default_retirement_profile()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_retirement_profile_state(
    state: State<'_, DbState>,
) -> Result<RetirementProfileState, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT current_age, retirement_age, life_expectancy, annual_income_cents,
                income_growth_rate, ss_monthly_benefit_cents, ss_claiming_age,
                retirement_spending_rate, inflation_rate, pre_retirement_return,
                post_retirement_return, withdrawal_rate, effective_tax_rate,
                state, filing_status
         FROM retirement_profile WHERE id = 'default'",
        [],
        |row| {
            Ok(RetirementProfile {
                current_age: row.get(0)?,
                retirement_age: row.get(1)?,
                life_expectancy: row.get(2)?,
                annual_income_cents: row.get(3)?,
                income_growth_rate: row.get(4)?,
                ss_monthly_benefit_cents: row.get(5)?,
                ss_claiming_age: row.get(6)?,
                retirement_spending_rate: row.get(7)?,
                inflation_rate: row.get(8)?,
                pre_retirement_return: row.get(9)?,
                post_retirement_return: row.get(10)?,
                withdrawal_rate: row.get(11)?,
                effective_tax_rate: row.get(12)?,
                state: row.get(13)?,
                filing_status: row.get(14)?,
            })
        },
    );

    match result {
        Ok(profile) => Ok(RetirementProfileState {
            profile,
            has_saved_profile: true,
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(RetirementProfileState {
            profile: default_retirement_profile(),
            has_saved_profile: false,
        }),
        Err(e) => Err(e.to_string()),
    }
}

fn default_retirement_profile() -> RetirementProfile {
    RetirementProfile {
        current_age: 30,
        retirement_age: 65,
        life_expectancy: 90,
        annual_income_cents: None,
        income_growth_rate: 0.03,
        ss_monthly_benefit_cents: None,
        ss_claiming_age: 67,
        retirement_spending_rate: 0.80,
        inflation_rate: 0.03,
        pre_retirement_return: 0.07,
        post_retirement_return: 0.05,
        withdrawal_rate: 0.04,
        effective_tax_rate: 0.22,
        state: None,
        filing_status: "single".to_string(),
    }
}

#[tauri::command]
pub fn save_retirement_profile(
    state: State<'_, DbState>,
    current_age: i32,
    retirement_age: i32,
    life_expectancy: i32,
    annual_income_cents: Option<i64>,
    income_growth_rate: f64,
    ss_monthly_benefit_cents: Option<i64>,
    ss_claiming_age: i32,
    retirement_spending_rate: f64,
    inflation_rate: f64,
    pre_retirement_return: f64,
    post_retirement_return: f64,
    withdrawal_rate: f64,
    effective_tax_rate: f64,
    state_name: Option<String>,
    filing_status: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO retirement_profile (
             id, current_age, retirement_age, life_expectancy, annual_income_cents,
             income_growth_rate, ss_monthly_benefit_cents, ss_claiming_age,
             retirement_spending_rate, inflation_rate, pre_retirement_return,
             post_retirement_return, withdrawal_rate, effective_tax_rate,
             state, filing_status, updated_at)
         VALUES ('default', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, datetime('now'))",
        rusqlite::params![
            current_age,
            retirement_age,
            life_expectancy,
            annual_income_cents,
            income_growth_rate,
            ss_monthly_benefit_cents,
            ss_claiming_age,
            retirement_spending_rate,
            inflation_rate,
            pre_retirement_return,
            post_retirement_return,
            withdrawal_rate,
            effective_tax_rate,
            state_name,
            filing_status,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Load profile, aggregate retirement assets, build SimulationParams, and run Monte Carlo.
#[tauri::command]
pub fn run_retirement_projection(
    state: State<'_, DbState>,
    overrides_json: Option<String>,
) -> Result<RetirementProjection, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // 1. Load profile
    let mut profile = {
        let result = conn.query_row(
            "SELECT current_age, retirement_age, life_expectancy, annual_income_cents,
                    income_growth_rate, ss_monthly_benefit_cents, ss_claiming_age,
                    retirement_spending_rate, inflation_rate, pre_retirement_return,
                    post_retirement_return, withdrawal_rate, effective_tax_rate,
                    state, filing_status
             FROM retirement_profile WHERE id = 'default'",
            [],
            |row| {
                Ok(RetirementProfile {
                    current_age: row.get(0)?,
                    retirement_age: row.get(1)?,
                    life_expectancy: row.get(2)?,
                    annual_income_cents: row.get(3)?,
                    income_growth_rate: row.get(4)?,
                    ss_monthly_benefit_cents: row.get(5)?,
                    ss_claiming_age: row.get(6)?,
                    retirement_spending_rate: row.get(7)?,
                    inflation_rate: row.get(8)?,
                    pre_retirement_return: row.get(9)?,
                    post_retirement_return: row.get(10)?,
                    withdrawal_rate: row.get(11)?,
                    effective_tax_rate: row.get(12)?,
                    state: row.get(13)?,
                    filing_status: row.get(14)?,
                })
            },
        );
        match result {
            Ok(p) => p,
            Err(rusqlite::Error::QueryReturnedNoRows) => default_retirement_profile(),
            Err(e) => return Err(e.to_string()),
        }
    };

    // 2. Apply overrides if provided
    if let Some(ref overrides_str) = overrides_json {
        if let Ok(overrides) = serde_json::from_str::<serde_json::Value>(overrides_str) {
            if let Some(v) = overrides.get("current_age").and_then(|v| v.as_i64()) {
                profile.current_age = v as i32;
            }
            if let Some(v) = overrides.get("retirement_age").and_then(|v| v.as_i64()) {
                profile.retirement_age = v as i32;
            }
            if let Some(v) = overrides.get("life_expectancy").and_then(|v| v.as_i64()) {
                profile.life_expectancy = v as i32;
            }
            if let Some(v) = overrides.get("pre_retirement_return").and_then(|v| v.as_f64()) {
                profile.pre_retirement_return = v;
            }
            if let Some(v) = overrides.get("post_retirement_return").and_then(|v| v.as_f64()) {
                profile.post_retirement_return = v;
            }
            if let Some(v) = overrides.get("inflation_rate").and_then(|v| v.as_f64()) {
                profile.inflation_rate = v;
            }
            if let Some(v) = overrides.get("withdrawal_rate").and_then(|v| v.as_f64()) {
                profile.withdrawal_rate = v;
            }
            if let Some(v) = overrides
                .get("ss_monthly_benefit_cents")
                .and_then(|v| v.as_i64())
            {
                profile.ss_monthly_benefit_cents = Some(v);
            }
            if let Some(v) = overrides.get("ss_claiming_age").and_then(|v| v.as_i64()) {
                profile.ss_claiming_age = v as i32;
            }
        }
    }

    // 3. Get current retirement portfolio value
    let total_retirement_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(current_value_cents), 0)
             FROM assets
             WHERE tax_treatment IN ('traditional', 'roth', '401k', '403b', 'ira')
                OR asset_type = 'retirement'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // 4. Estimate monthly contribution from YTD data
    let current_month = Utc::now().month() as f64;
    let monthly_contribution_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(contribution_ytd_cents), 0) FROM assets
             WHERE tax_treatment IN ('traditional', 'roth', '401k', '403b', 'ira')
                OR asset_type = 'retirement'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())
        .map(|ytd| {
            if current_month > 0.0 {
                (ytd as f64 / current_month) as i64
            } else {
                50000i64 // $500/month default
            }
        })?;

    // 5. Build SimulationParams
    let current_portfolio = total_retirement_cents as f64 / 100.0;
    let monthly_contribution = monthly_contribution_cents as f64 / 100.0;
    let years_to_retirement = (profile.retirement_age - profile.current_age).max(0);
    let years_in_retirement = (profile.life_expectancy - profile.retirement_age).max(0);

    // Social Security adjustment
    let base_ss_monthly = profile.ss_monthly_benefit_cents.unwrap_or(0) as f64 / 100.0;
    let adjusted_ss_monthly = projections::ss_benefit_at_age(base_ss_monthly, profile.ss_claiming_age, 67);
    let ss_annual = adjusted_ss_monthly * 12.0;

    // SS starts at claiming age, relative to retirement
    let ss_start_year = if profile.ss_claiming_age >= profile.retirement_age {
        profile.ss_claiming_age - profile.retirement_age
    } else {
        0
    };

    let params = monte_carlo::SimulationParams {
        current_portfolio,
        monthly_contribution,
        years_to_retirement,
        years_in_retirement,
        pre_retirement_return: profile.pre_retirement_return,
        post_retirement_return: profile.post_retirement_return,
        pre_retirement_stddev: 0.15,
        post_retirement_stddev: 0.10,
        inflation_rate: profile.inflation_rate,
        withdrawal_rate: profile.withdrawal_rate,
        ss_annual_benefit: ss_annual,
        ss_start_year,
        current_age: profile.current_age,
    };

    // 6. Run simulation
    let sim_result = monte_carlo::run_simulation(&params, 1000);

    // Convert SimulationResult to RetirementProjection
    let median_percentile = sim_result.percentiles.iter().find(|p| p.percentile == 50);
    let monthly_retirement_income = median_percentile.map(|p| p.monthly_income).unwrap_or(0.0);
    let years_funded_median = median_percentile.map(|p| p.years_funded).unwrap_or(0.0);

    Ok(RetirementProjection {
        success_probability: sim_result.success_probability,
        median_portfolio_at_retirement: sim_result.median_portfolio_at_retirement,
        monthly_retirement_income,
        years_funded_median,
        required_monthly_savings: monthly_contribution,
        percentiles: sim_result.percentiles.into_iter().map(|p| ProjectionPercentile {
            percentile: p.percentile,
            portfolio_at_retirement: p.portfolio_at_retirement,
            years_funded: p.years_funded,
            monthly_income: p.monthly_income,
        }).collect(),
        yearly_data: sim_result.yearly_data.into_iter().map(|y| YearlyProjection {
            age: y.age,
            year: y.year,
            p10: y.p10,
            p25: y.p25,
            p50: y.p50,
            p75: y.p75,
            p90: y.p90,
        }).collect(),
    })
}

#[tauri::command]
pub fn get_required_savings_rate(
    state: State<'_, DbState>,
    target_age: i32,
) -> Result<f64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let profile = {
        let result = conn.query_row(
            "SELECT current_age, retirement_age, life_expectancy, annual_income_cents,
                    income_growth_rate, ss_monthly_benefit_cents, ss_claiming_age,
                    retirement_spending_rate, inflation_rate, pre_retirement_return,
                    post_retirement_return, withdrawal_rate, effective_tax_rate,
                    state, filing_status
             FROM retirement_profile WHERE id = 'default'",
            [],
            |row| {
                Ok(RetirementProfile {
                    current_age: row.get(0)?,
                    retirement_age: row.get(1)?,
                    life_expectancy: row.get(2)?,
                    annual_income_cents: row.get(3)?,
                    income_growth_rate: row.get(4)?,
                    ss_monthly_benefit_cents: row.get(5)?,
                    ss_claiming_age: row.get(6)?,
                    retirement_spending_rate: row.get(7)?,
                    inflation_rate: row.get(8)?,
                    pre_retirement_return: row.get(9)?,
                    post_retirement_return: row.get(10)?,
                    withdrawal_rate: row.get(11)?,
                    effective_tax_rate: row.get(12)?,
                    state: row.get(13)?,
                    filing_status: row.get(14)?,
                })
            },
        );
        match result {
            Ok(p) => p,
            Err(rusqlite::Error::QueryReturnedNoRows) => default_retirement_profile(),
            Err(e) => return Err(e.to_string()),
        }
    };

    let total_retirement_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(current_value_cents), 0) FROM assets
             WHERE tax_treatment IN ('traditional', 'roth', '401k', '403b', 'ira')
                OR asset_type = 'retirement'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let current_portfolio = total_retirement_cents as f64 / 100.0;
    let years_to_retirement = (target_age - profile.current_age).max(0);
    let years_in_retirement = (profile.life_expectancy - target_age).max(0);

    let base_ss_monthly = profile.ss_monthly_benefit_cents.unwrap_or(0) as f64 / 100.0;
    let adjusted_ss_monthly = projections::ss_benefit_at_age(base_ss_monthly, profile.ss_claiming_age, 67);
    let ss_annual = adjusted_ss_monthly * 12.0;
    let ss_start_year = if profile.ss_claiming_age >= target_age {
        profile.ss_claiming_age - target_age
    } else {
        0
    };

    let build_params = |monthly: f64| monte_carlo::SimulationParams {
        current_portfolio,
        monthly_contribution: monthly,
        years_to_retirement,
        years_in_retirement,
        pre_retirement_return: profile.pre_retirement_return,
        post_retirement_return: profile.post_retirement_return,
        pre_retirement_stddev: 0.15,
        post_retirement_stddev: 0.10,
        inflation_rate: profile.inflation_rate,
        withdrawal_rate: profile.withdrawal_rate,
        ss_annual_benefit: ss_annual,
        ss_start_year,
        current_age: profile.current_age,
    };

    // Binary search: find minimum monthly contribution for >= 80% success
    let target_success = 0.80;

    // Phase 1: find upper bound by doubling from $100/month
    let mut lo: f64 = 100.0;
    let mut hi: f64 = 100.0;

    loop {
        let params = build_params(hi);
        let result = monte_carlo::run_simulation(&params, 200);
        if result.success_probability >= target_success {
            break;
        }
        hi *= 2.0;
        if hi > 1_000_000.0 {
            // Even $1M/month doesn't work — return the cap
            return Ok(hi);
        }
    }

    // Phase 2: binary search between lo and hi
    for _ in 0..20 {
        let mid = (lo + hi) / 2.0;
        let params = build_params(mid);
        let result = monte_carlo::run_simulation(&params, 200);
        if result.success_probability >= target_success {
            hi = mid;
        } else {
            lo = mid;
        }
        if hi - lo < 1.0 {
            break;
        }
    }

    Ok(hi.ceil())
}

#[tauri::command]
pub fn get_ss_comparison(state: State<'_, DbState>) -> Result<Vec<(i32, f64, f64)>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let ss_monthly_benefit_cents: Option<i64> = conn
        .query_row(
            "SELECT ss_monthly_benefit_cents FROM retirement_profile WHERE id = 'default'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let base_monthly = ss_monthly_benefit_cents.unwrap_or(0) as f64 / 100.0;

    let comparison_ages = [62i32, 67, 70];
    let result = comparison_ages
        .iter()
        .map(|&age| {
            let monthly = projections::ss_benefit_at_age(base_monthly, age, 67);
            let annual = monthly * 12.0;
            (age, monthly, annual)
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub fn save_retirement_scenario(
    state: State<'_, DbState>,
    name: String,
    description: Option<String>,
    overrides_json: String,
) -> Result<RetirementScenario, String> {
    // Run projection with overrides to cache the result
    // We need to temporarily release the lock for run_retirement_projection, so we call the
    // underlying logic directly using a helper.
    let (result_json, created_at, id) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        // Load and apply overrides inline (same logic as run_retirement_projection)
        let mut profile = {
            let result = conn.query_row(
                "SELECT current_age, retirement_age, life_expectancy, annual_income_cents,
                        income_growth_rate, ss_monthly_benefit_cents, ss_claiming_age,
                        retirement_spending_rate, inflation_rate, pre_retirement_return,
                        post_retirement_return, withdrawal_rate, effective_tax_rate,
                        state_name, filing_status
                 FROM retirement_profile WHERE id = 'default'",
                [],
                |row| {
                    Ok(RetirementProfile {
                        current_age: row.get(0)?,
                        retirement_age: row.get(1)?,
                        life_expectancy: row.get(2)?,
                        annual_income_cents: row.get(3)?,
                        income_growth_rate: row.get(4)?,
                        ss_monthly_benefit_cents: row.get(5)?,
                        ss_claiming_age: row.get(6)?,
                        retirement_spending_rate: row.get(7)?,
                        inflation_rate: row.get(8)?,
                        pre_retirement_return: row.get(9)?,
                        post_retirement_return: row.get(10)?,
                        withdrawal_rate: row.get(11)?,
                        effective_tax_rate: row.get(12)?,
                        state: row.get(13)?,
                        filing_status: row.get(14)?,
                    })
                },
            );
            match result {
                Ok(p) => p,
                Err(rusqlite::Error::QueryReturnedNoRows) => default_retirement_profile(),
                Err(e) => return Err(e.to_string()),
            }
        };

        if let Ok(overrides) = serde_json::from_str::<serde_json::Value>(&overrides_json) {
            if let Some(v) = overrides.get("current_age").and_then(|v| v.as_i64()) {
                profile.current_age = v as i32;
            }
            if let Some(v) = overrides.get("retirement_age").and_then(|v| v.as_i64()) {
                profile.retirement_age = v as i32;
            }
            if let Some(v) = overrides.get("life_expectancy").and_then(|v| v.as_i64()) {
                profile.life_expectancy = v as i32;
            }
            if let Some(v) = overrides.get("pre_retirement_return").and_then(|v| v.as_f64()) {
                profile.pre_retirement_return = v;
            }
            if let Some(v) = overrides.get("post_retirement_return").and_then(|v| v.as_f64()) {
                profile.post_retirement_return = v;
            }
            if let Some(v) = overrides.get("inflation_rate").and_then(|v| v.as_f64()) {
                profile.inflation_rate = v;
            }
            if let Some(v) = overrides.get("withdrawal_rate").and_then(|v| v.as_f64()) {
                profile.withdrawal_rate = v;
            }
        }

        let total_retirement_cents: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(current_value_cents), 0) FROM assets
                 WHERE tax_treatment IN ('traditional', 'roth', '401k', '403b', 'ira')
                    OR asset_type = 'retirement'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let current_month = Utc::now().month() as f64;
        let monthly_contribution_cents: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(contribution_ytd_cents), 0) FROM assets
                 WHERE tax_treatment IN ('traditional', 'roth', '401k', '403b', 'ira')
                    OR asset_type = 'retirement'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| e.to_string())
            .map(|ytd| {
                if current_month > 0.0 {
                    (ytd as f64 / current_month) as i64
                } else {
                    50000i64
                }
            })?;

        let current_portfolio = total_retirement_cents as f64 / 100.0;
        let monthly_contribution = monthly_contribution_cents as f64 / 100.0;
        let years_to_retirement = (profile.retirement_age - profile.current_age).max(0);
        let years_in_retirement = (profile.life_expectancy - profile.retirement_age).max(0);

        let base_ss_monthly = profile.ss_monthly_benefit_cents.unwrap_or(0) as f64 / 100.0;
        let adjusted_ss_monthly =
            projections::ss_benefit_at_age(base_ss_monthly, profile.ss_claiming_age, 67);
        let ss_annual = adjusted_ss_monthly * 12.0;
        let ss_start_year = if profile.ss_claiming_age >= profile.retirement_age {
            profile.ss_claiming_age - profile.retirement_age
        } else {
            0
        };

        let params = monte_carlo::SimulationParams {
            current_portfolio,
            monthly_contribution,
            years_to_retirement,
            years_in_retirement,
            pre_retirement_return: profile.pre_retirement_return,
            post_retirement_return: profile.post_retirement_return,
            pre_retirement_stddev: 0.15,
            post_retirement_stddev: 0.10,
            inflation_rate: profile.inflation_rate,
            withdrawal_rate: profile.withdrawal_rate,
            ss_annual_benefit: ss_annual,
            ss_start_year,
            current_age: profile.current_age,
        };

        let projection: monte_carlo::SimulationResult = monte_carlo::run_simulation(&params, 1000);
        let result_json = serde_json::to_string(&projection).map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO retirement_scenarios (id, name, description, overrides_json, result_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![id, name, description, overrides_json, result_json, now],
        )
        .map_err(|e| e.to_string())?;

        (result_json, now, id)
    };

    Ok(RetirementScenario {
        id,
        name,
        description,
        overrides_json,
        result_json: Some(result_json),
        created_at,
    })
}

#[tauri::command]
pub fn get_retirement_scenarios(
    state: State<'_, DbState>,
) -> Result<Vec<RetirementScenario>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, overrides_json, result_json, created_at
             FROM retirement_scenarios
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let scenarios = stmt
        .query_map([], |row| {
            Ok(RetirementScenario {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                overrides_json: row.get(3)?,
                result_json: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse retirement scenario row: {}", e);
                None
            }
        })
        .collect();

    Ok(scenarios)
}
