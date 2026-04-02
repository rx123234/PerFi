use crate::db::DbState;
use crate::models::*;
use chrono::{Datelike, Duration, NaiveDate, Utc};
use rand::Rng;
use rand_distr::{Distribution, Normal};
use std::collections::HashMap;
use tauri::State;

const NO_TRANSFER: &str =
    "t.category_id NOT IN (SELECT id FROM categories WHERE name = 'Transfer')";
const INCLUDED_IN_PLANNING: &str =
    "COALESCE(t.exclude_from_planning, 0) = 0 AND COALESCE(c.exclude_from_planning, 0) = 0";

fn income_pred() -> &'static str {
    "a.account_type = 'checking' AND t.amount_cents > 0"
}

fn spending_pred() -> &'static str {
    "(a.account_type = 'credit_card' AND t.amount_cents > 0) OR (a.account_type IN ('checking', 'savings') AND t.amount_cents < 0)"
}

fn spending_amount() -> &'static str {
    "ABS(t.amount_cents)"
}

/// Month names indexed 1-12
const MONTH_NAMES: [&str; 12] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

/// Add `months` to a NaiveDate, clamping day to end-of-month.
fn add_months(date: NaiveDate, months: i32) -> NaiveDate {
    let total = date.year() * 12 + date.month() as i32 - 1 + months;
    let year = total / 12;
    let month = (total % 12 + 1) as u32;
    NaiveDate::from_ymd_opt(year, month, date.day())
        .or_else(|| {
            NaiveDate::from_ymd_opt(year, month + 1, 1)
                .and_then(|d| d.pred_opt())
        })
        .unwrap_or(date)
}

fn month_start(date: NaiveDate) -> NaiveDate {
    NaiveDate::from_ymd_opt(date.year(), date.month(), 1).unwrap_or(date)
}

fn next_month_start(date: NaiveDate) -> NaiveDate {
    add_months(month_start(date), 1)
}

fn month_end(date: NaiveDate) -> NaiveDate {
    next_month_start(date)
        .pred_opt()
        .unwrap_or(date)
}

#[derive(Clone)]
struct RecurringStream {
    name: String,
    cadence_days: i64,
    average_amount: f64,
    amount_cv: f64,
    confidence: f64,
    last_seen: NaiveDate,
}

fn mean(values: &[f64]) -> f64 {
    if values.is_empty() {
        0.0
    } else {
        values.iter().sum::<f64>() / values.len() as f64
    }
}

fn coeff_var(values: &[f64]) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    let avg = mean(values);
    if avg <= 0.0 {
        return 0.0;
    }
    let variance = values
        .iter()
        .map(|value| (value - avg).powi(2))
        .sum::<f64>()
        / values.len() as f64;
    variance.sqrt() / avg
}

fn percentile(sorted: &[f64], pct: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let idx = ((sorted.len() - 1) as f64 * pct).round() as usize;
    sorted[idx.min(sorted.len() - 1)]
}

fn month_key(date: NaiveDate) -> String {
    date.format("%Y-%m").to_string()
}

fn infer_recurring_streams(entries: &[(String, NaiveDate, f64)]) -> Vec<RecurringStream> {
    let mut grouped: HashMap<String, Vec<(NaiveDate, f64)>> = HashMap::new();
    for (name, date, amount) in entries {
        grouped.entry(name.clone()).or_default().push((*date, *amount));
    }

    let mut streams = Vec::new();

    for (name, mut txs) in grouped {
        if txs.len() < 3 {
            continue;
        }

        txs.sort_by_key(|(date, _)| *date);

        let intervals: Vec<f64> = txs
            .windows(2)
            .filter_map(|pair| {
                let days = (pair[1].0 - pair[0].0).num_days();
                if days > 0 { Some(days as f64) } else { None }
            })
            .collect();

        if intervals.len() < 2 {
            continue;
        }

        let mut sorted_intervals = intervals.clone();
        sorted_intervals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let median_interval = sorted_intervals[sorted_intervals.len() / 2] as i64;

        if !matches!(median_interval, 6..=9 | 12..=17 | 27..=35) {
            continue;
        }

        let amounts: Vec<f64> = txs.iter().map(|(_, amount)| *amount).collect();
        let amount_cv = coeff_var(&amounts);
        let interval_cv = coeff_var(&intervals);
        let cadence_consistency = 1.0 - interval_cv.min(1.0);
        let amount_consistency = 1.0 - amount_cv.min(1.0);
        let coverage = (txs.len().min(8) as f64) / 8.0;
        let confidence = (cadence_consistency * 0.45
            + amount_consistency * 0.35
            + coverage * 0.20)
            .clamp(0.35, 0.96);

        if confidence < 0.55 {
            continue;
        }

        streams.push(RecurringStream {
            name,
            cadence_days: median_interval,
            average_amount: mean(&amounts),
            amount_cv,
            confidence,
            last_seen: txs.last().map(|(date, _)| *date).unwrap_or_else(|| Utc::now().date_naive()),
        });
    }

    streams
}

fn monthly_actuals_for_streams(
    streams: &[RecurringStream],
    entries: &[(String, NaiveDate, f64)],
) -> HashMap<String, f64> {
    let recurring_names: std::collections::HashSet<&str> =
        streams.iter().map(|stream| stream.name.as_str()).collect();
    let mut totals = HashMap::new();

    for (name, date, amount) in entries {
        if recurring_names.contains(name.as_str()) {
            *totals.entry(month_key(*date)).or_insert(0.0) += *amount;
        }
    }

    totals
}

fn scenario_stream_amount<R: Rng + ?Sized>(
    stream: &RecurringStream,
    forecast_month: NaiveDate,
    rng: &mut R,
) -> f64 {
    let start = month_start(forecast_month);
    let end = month_end(forecast_month);
    let mut next_due = stream.last_seen + Duration::days(stream.cadence_days.max(1));
    while next_due < start {
        next_due += Duration::days(stream.cadence_days.max(1));
    }

    let amount_sigma = (stream.amount_cv * 0.75).clamp(0.01, 0.30);
    let amount_dist = Normal::new(0.0, amount_sigma).ok();
    let occurrence_prob = (0.72 + stream.confidence * 0.25).clamp(0.65, 0.98);
    let mut total = 0.0;

    while next_due <= end {
        if rng.gen_bool(occurrence_prob) {
            let noise = amount_dist.as_ref().map(|dist| dist.sample(rng)).unwrap_or(0.0);
            total += (stream.average_amount * (1.0 + noise)).max(stream.average_amount * 0.55);
        }
        next_due += Duration::days(stream.cadence_days.max(1));
    }

    total
}

fn scenario_residual_amount<R: Rng + ?Sized>(
    baseline: f64,
    trend: f64,
    seasonal_ratio: f64,
    variability: f64,
    offset: i32,
    rng: &mut R,
) -> f64 {
    let trended = (baseline + trend * offset as f64).max(0.0);
    let sigma = variability.clamp(0.04, 0.35);
    let dist = Normal::new(0.0, sigma).ok();
    let noise = dist.as_ref().map(|d| d.sample(rng)).unwrap_or(0.0);
    (trended * seasonal_ratio * (1.0 + noise)).max(0.0)
}

fn weighted_recent_average(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }

    let (weighted_sum, total_weight) = values
        .iter()
        .enumerate()
        .fold((0.0, 0.0), |(sum, weight_sum), (idx, value)| {
            let weight = (idx + 1) as f64;
            (sum + value * weight, weight_sum + weight)
        });

    if total_weight > 0.0 {
        weighted_sum / total_weight
    } else {
        0.0
    }
}

fn simple_trend_per_month(values: &[f64]) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    (values[values.len() - 1] - values[0]) / (values.len() - 1) as f64
}

#[tauri::command]
pub fn get_cash_flow_forecast(
    state: State<'_, DbState>,
    months: i32,
) -> Result<Vec<ForecastPoint>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let months = months.max(1).min(60);

    let now = Utc::now().date_naive();
    let current_month_start = month_start(now);
    let history_start = add_months(current_month_start, -12);
    let history_start_str = history_start.format("%Y-%m-%d").to_string();
    let current_month_start_str = current_month_start.format("%Y-%m-%d").to_string();

    let income_monthly_sql = format!(
        "SELECT strftime('%Y-%m', t.date) as month,
                CAST(SUM(t.amount_cents) AS REAL) / 100.0 as monthly_total
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE {income_pred}
           AND t.date >= ?1 AND t.date < ?2
           AND t.pending = 0
           AND {included_in_planning}
           AND {no_transfer}
         GROUP BY month
         ORDER BY month",
        income_pred = income_pred(),
        included_in_planning = INCLUDED_IN_PLANNING,
        no_transfer = NO_TRANSFER,
    );

    let spending_monthly_sql = format!(
        "SELECT strftime('%Y-%m', t.date) as month,
                CAST(SUM({spending_amount}) AS REAL) / 100.0 as monthly_total
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE ({spending_pred})
           AND t.date >= ?1 AND t.date < ?2
           AND t.pending = 0
           AND COALESCE(c.name, '') != 'Income'
           AND {included_in_planning}
           AND {no_transfer}
         GROUP BY month
         ORDER BY month",
        spending_amount = spending_amount(),
        spending_pred = spending_pred(),
        included_in_planning = INCLUDED_IN_PLANNING,
        no_transfer = NO_TRANSFER,
    );

    let load_monthly_series = |sql: &str| -> Result<Vec<(String, f64)>, String> {
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(
                rusqlite::params![history_start_str, current_month_start_str],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?)),
            )
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    };

    let income_rows = load_monthly_series(&income_monthly_sql)?;
    let spending_rows = load_monthly_series(&spending_monthly_sql)?;

    let income_tx_sql = format!(
        "SELECT COALESCE(NULLIF(TRIM(t.merchant), ''), t.description) as source_name,
                t.date,
                CAST(t.amount_cents AS REAL) / 100.0 as amount
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE {income_pred}
           AND t.date >= ?1 AND t.date < ?2
           AND t.pending = 0
           AND {included_in_planning}
           AND {no_transfer}
         ORDER BY t.date",
        income_pred = income_pred(),
        included_in_planning = INCLUDED_IN_PLANNING,
        no_transfer = NO_TRANSFER,
    );

    let spending_tx_sql = format!(
        "SELECT COALESCE(NULLIF(TRIM(t.merchant), ''), t.description) as source_name,
                t.date,
                CAST({spending_amount} AS REAL) / 100.0 as amount
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE ({spending_pred})
           AND t.date >= ?1 AND t.date < ?2
           AND t.pending = 0
           AND COALESCE(c.name, '') != 'Income'
           AND {included_in_planning}
           AND {no_transfer}
         ORDER BY t.date",
        spending_amount = spending_amount(),
        spending_pred = spending_pred(),
        included_in_planning = INCLUDED_IN_PLANNING,
        no_transfer = NO_TRANSFER,
    );

    let load_entries = |sql: &str| -> Result<Vec<(String, NaiveDate, f64)>, String> {
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(
                rusqlite::params![history_start_str, current_month_start_str],
                |row| {
                    let date_str: String = row.get(1)?;
                    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                        .map_err(|err| {
                            rusqlite::Error::FromSqlConversionFailure(
                                1,
                                rusqlite::types::Type::Text,
                                Box::new(err),
                            )
                        })?;
                    Ok((row.get::<_, String>(0)?, date, row.get::<_, f64>(2)?))
                },
            )
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    };

    let income_entries = load_entries(&income_tx_sql)?;
    let spending_entries = load_entries(&spending_tx_sql)?;
    let income_streams = infer_recurring_streams(&income_entries);
    let spending_streams = infer_recurring_streams(&spending_entries);

    let income_by_month: HashMap<String, f64> = income_rows.iter().cloned().collect();
    let spending_by_month: HashMap<String, f64> = spending_rows.iter().cloned().collect();
    let recurring_income_by_month = monthly_actuals_for_streams(&income_streams, &income_entries);
    let recurring_spending_by_month =
        monthly_actuals_for_streams(&spending_streams, &spending_entries);

    let history_months: Vec<NaiveDate> = (0..12)
        .map(|offset| add_months(current_month_start, offset - 12))
        .collect();

    let income_history: Vec<f64> = history_months
        .iter()
        .map(|date| {
            income_by_month
                .get(&date.format("%Y-%m").to_string())
                .copied()
                .unwrap_or(0.0)
        })
        .collect();

    let total_spending_history: Vec<f64> = history_months
        .iter()
        .map(|date| {
            spending_by_month
                .get(&date.format("%Y-%m").to_string())
                .copied()
                .unwrap_or(0.0)
        })
        .collect();

    let recurring_income_history: Vec<f64> = history_months
        .iter()
        .map(|date| recurring_income_by_month.get(&month_key(*date)).copied().unwrap_or(0.0))
        .collect();

    let recurring_spending_history: Vec<f64> = history_months
        .iter()
        .map(|date| recurring_spending_by_month.get(&month_key(*date)).copied().unwrap_or(0.0))
        .collect();

    let residual_income_history: Vec<f64> = income_history
        .iter()
        .zip(recurring_income_history.iter())
        .map(|(total, recurring)| (total - recurring).max(0.0))
        .collect();

    let residual_spending_history: Vec<f64> = total_spending_history
        .iter()
        .zip(recurring_spending_history.iter())
        .map(|(total, recurring)| (total - recurring).max(0.0))
        .collect();

    let recent_income: Vec<f64> = income_history.iter().copied().filter(|v| *v > 0.0).collect();
    let recent_spending: Vec<f64> = total_spending_history
        .iter()
        .copied()
        .filter(|v| *v > 0.0)
        .collect();
    let recent_residual_income: Vec<f64> = residual_income_history
        .iter()
        .copied()
        .filter(|v| *v > 0.0)
        .collect();
    let recent_residual_spending: Vec<f64> = residual_spending_history
        .iter()
        .copied()
        .filter(|v| *v > 0.0)
        .collect();

    let baseline_residual_income = weighted_recent_average(&recent_residual_income);
    let baseline_residual_spending = weighted_recent_average(&recent_residual_spending);

    let residual_income_trend = simple_trend_per_month(
        &residual_income_history
            .iter()
            .rev()
            .take(6)
            .copied()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>(),
    );
    let residual_spending_trend = simple_trend_per_month(
        &residual_spending_history
            .iter()
            .rev()
            .take(6)
            .copied()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>(),
    );

    let residual_income_annual_avg = if recent_residual_income.is_empty() {
        baseline_residual_income
    } else {
        recent_residual_income.iter().sum::<f64>() / recent_residual_income.len() as f64
    };
    let residual_spending_annual_avg = if recent_residual_spending.is_empty() {
        baseline_residual_spending
    } else {
        recent_residual_spending.iter().sum::<f64>() / recent_residual_spending.len() as f64
    };

    let mut income_seasonality: HashMap<u32, f64> = HashMap::new();
    let mut spending_seasonality: HashMap<u32, f64> = HashMap::new();
    let mut month_counts: HashMap<u32, usize> = HashMap::new();

    for (idx, date) in history_months.iter().enumerate() {
        let key = date.month();
        let income_value = residual_income_history[idx];
        let spending_value = residual_spending_history[idx];

        if income_value > 0.0 || spending_value > 0.0 {
            *month_counts.entry(key).or_insert(0) += 1;
        }
        if income_value > 0.0 && residual_income_annual_avg > 0.0 {
            income_seasonality.insert(key, income_value / residual_income_annual_avg);
        }
        if spending_value > 0.0 && residual_spending_annual_avg > 0.0 {
            spending_seasonality.insert(key, spending_value / residual_spending_annual_avg);
        }
    }

    let mut result = Vec::with_capacity(months as usize);
    let income_data_points = recent_income.len() as f64;
    let spending_data_points = recent_spending.len() as f64;
    let residual_income_cv = coeff_var(&recent_residual_income);
    let residual_spending_cv = coeff_var(&recent_residual_spending);
    let recurring_income_cv = coeff_var(&recurring_income_history);
    let recurring_spending_cv = coeff_var(&recurring_spending_history);
    let stream_confidences: Vec<f64> = income_streams
        .iter()
        .map(|stream| stream.confidence)
        .chain(spending_streams.iter().map(|stream| stream.confidence))
        .collect();
    let base_stream_confidence = mean(&stream_confidences);
    let scenario_count = 300;
    let mut rng = rand::thread_rng();

    for offset in 0..months {
        let forecast_date = add_months(current_month_start, offset + 1);
        let calendar_month = forecast_date.month();
        let month_label = forecast_date.format("%Y-%m").to_string();

        let income_ratio = income_seasonality.get(&calendar_month).copied().unwrap_or(1.0);
        let spending_ratio = spending_seasonality.get(&calendar_month).copied().unwrap_or(1.0);

        let mut income_samples = Vec::with_capacity(scenario_count);
        let mut spending_samples = Vec::with_capacity(scenario_count);
        let mut net_samples = Vec::with_capacity(scenario_count);

        for _ in 0..scenario_count {
            let scheduled_income = income_streams
                .iter()
                .map(|stream| scenario_stream_amount(stream, forecast_date, &mut rng))
                .sum::<f64>();
            let scheduled_spending = spending_streams
                .iter()
                .map(|stream| scenario_stream_amount(stream, forecast_date, &mut rng))
                .sum::<f64>();

            let residual_income = scenario_residual_amount(
                baseline_residual_income,
                residual_income_trend,
                income_ratio.clamp(0.80, 1.20),
                residual_income_cv.max(recurring_income_cv * 0.5),
                offset + 1,
                &mut rng,
            );
            let residual_spending = scenario_residual_amount(
                baseline_residual_spending,
                residual_spending_trend,
                spending_ratio.clamp(0.75, 1.35),
                residual_spending_cv.max(recurring_spending_cv * 0.5),
                offset + 1,
                &mut rng,
            );

            let projected_income = scheduled_income + residual_income;
            let projected_spending = scheduled_spending + residual_spending;
            let projected_net = projected_income - projected_spending;

            income_samples.push(projected_income);
            spending_samples.push(projected_spending);
            net_samples.push(projected_net);
        }

        income_samples.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        spending_samples.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        net_samples.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let projected_income = mean(&income_samples);
        let projected_spending = mean(&spending_samples);
        let projected_net = mean(&net_samples);
        let net_p10 = percentile(&net_samples, 0.10);
        let net_p90 = percentile(&net_samples, 0.90);
        let spread_ratio = if projected_income.abs() + projected_spending.abs() > 0.0 {
            ((net_p90 - net_p10).abs() / (projected_income.abs() + projected_spending.abs())).min(1.0)
        } else {
            1.0
        };

        let coverage_score =
            ((income_data_points.min(8.0) / 8.0) * 0.30) + ((spending_data_points.min(8.0) / 8.0) * 0.30);
        let seasonal_score = if month_counts.get(&calendar_month).copied().unwrap_or(0) > 0 {
            0.10
        } else {
            0.0
        };
        let stream_score = base_stream_confidence * 0.20;
        let stability_score = (1.0 - spread_ratio) * 0.20;
        let horizon_penalty = offset as f64 * 0.045;
        let confidence =
            (coverage_score + seasonal_score + stream_score + stability_score - horizon_penalty)
                .clamp(0.30, 0.95);

        result.push(ForecastPoint {
            month: month_label,
            projected_income,
            projected_spending,
            projected_net,
            net_p10,
            net_p90,
            confidence,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_upcoming_bills(
    state: State<'_, DbState>,
    days: i32,
) -> Result<Vec<UpcomingBill>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let days = days.max(1).min(90);

    let now = Utc::now().date_naive();
    let lookback_start = add_months(month_start(now), -6);
    let lookback_start_str = lookback_start.format("%Y-%m-%d").to_string();
    let today_str = now.format("%Y-%m-%d").to_string();
    let cutoff = now + Duration::days(days as i64);

    // Find merchants appearing in >= 2 months of the last 6 months using spending rules.
    let mut stmt = conn
        .prepare(&format!(
            "SELECT COALESCE(t.merchant, t.description) as merchant_name,
                    COUNT(DISTINCT strftime('%Y-%m', t.date)) as month_count,
                    COALESCE(c.name, 'Uncategorized') as cat_name
             FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             LEFT JOIN categories c ON t.category_id = c.id
             WHERE ({spending_pred})
               AND t.date >= ?1 AND t.date <= ?2
               AND t.pending = 0
               AND COALESCE(c.name, '') NOT IN ('Transfer', 'Income')
               AND {included_in_planning}
               AND {no_transfer}
             GROUP BY merchant_name
             HAVING month_count >= 2
             ORDER BY merchant_name",
            spending_pred = spending_pred(),
            included_in_planning = INCLUDED_IN_PLANNING,
            no_transfer = NO_TRANSFER,
        ))
        .map_err(|e| e.to_string())?;

    let recurring_merchants: Vec<(String, i64, String)> = stmt
        .query_map(rusqlite::params![lookback_start_str, today_str], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut bills: Vec<UpcomingBill> = Vec::new();

    for (merchant, month_count, category) in &recurring_merchants {
        // Last transactions for this merchant using app spending rules.
        let mut detail_stmt = conn
            .prepare(&format!(
                "SELECT t.date, ABS(t.amount_cents)
                 FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE COALESCE(t.merchant, t.description) = ?1
                   AND ({spending_pred})
                   AND t.date >= ?2 AND t.date <= ?3
                   AND t.pending = 0
                   AND COALESCE(c.name, '') != 'Income'
                   AND {included_in_planning}
                   AND {no_transfer}
                 ORDER BY t.date DESC
                 LIMIT 8",
                spending_pred = spending_pred(),
                included_in_planning = INCLUDED_IN_PLANNING,
                no_transfer = NO_TRANSFER,
            ))
            .map_err(|e| e.to_string())?;

        let details: Vec<(String, i64)> = detail_stmt
            .query_map(
                rusqlite::params![merchant, lookback_start_str, today_str],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        if details.is_empty() {
            continue;
        }

        let sample: Vec<&(String, i64)> = details.iter().take(4).collect();
        let avg_amount_cents: f64 =
            sample.iter().map(|(_, a)| *a as f64).sum::<f64>() / sample.len() as f64;

        let parsed_dates: Vec<NaiveDate> = details
            .iter()
            .filter_map(|(date_str, _)| NaiveDate::parse_from_str(date_str, "%Y-%m-%d").ok())
            .collect();
        if parsed_dates.is_empty() {
            continue;
        }

        let mut intervals: Vec<i64> = parsed_dates
            .windows(2)
            .filter_map(|pair| {
                let days_between = (pair[0] - pair[1]).num_days().abs();
                if days_between > 0 { Some(days_between) } else { None }
            })
            .collect();
        intervals.sort_unstable();
        let median_interval = if intervals.is_empty() {
            30
        } else {
            intervals[intervals.len() / 2]
        };

        let last_seen = parsed_dates[0];
        let mut expected_date = last_seen + Duration::days(median_interval);
        while expected_date < now {
            expected_date += Duration::days(median_interval.max(1));
        }
        if expected_date > cutoff {
            continue;
        }

        // Confidence based on day and amount consistency
        let cadence_consistency = if intervals.len() >= 2 {
            let mean = intervals.iter().sum::<i64>() as f64 / intervals.len() as f64;
            let variance = intervals
                .iter()
                .map(|days_between| (*days_between as f64 - mean).powi(2))
                .sum::<f64>()
                / intervals.len() as f64;
            let cv = if mean > 0.0 { variance.sqrt() / mean } else { 1.0 };
            1.0 - cv.min(1.0)
        } else {
            0.5
        };

        let amount_consistency = if sample.len() >= 2 {
            let amounts: Vec<f64> = sample.iter().map(|(_, a)| *a as f64).collect();
            let mean = amounts.iter().sum::<f64>() / amounts.len() as f64;
            let variance = amounts
                .iter()
                .map(|a| (a - mean).powi(2))
                .sum::<f64>()
                / amounts.len() as f64;
            let cv = if mean > 0.0 {
                variance.sqrt() / mean
            } else {
                1.0
            };
            1.0 - cv.min(1.0)
        } else {
            0.5
        };

        let cadence_score = match median_interval {
            24..=38 => 1.0,
            12..=18 => 0.85,
            6..=10 => 0.75,
            _ => 0.55,
        };

        let confidence = (cadence_consistency * 0.35
            + amount_consistency * 0.35
            + cadence_score * 0.15
            + ((*month_count as f64 / 4.0).min(1.0) * 0.15))
            .clamp(0.35, 0.95);

        bills.push(UpcomingBill {
            merchant: merchant.clone(),
            expected_amount: avg_amount_cents / 100.0,
            expected_date: expected_date.format("%Y-%m-%d").to_string(),
            category: category.clone(),
            confidence,
        });
    }

    bills.sort_by(|a, b| a.expected_date.cmp(&b.expected_date));

    Ok(bills)
}

#[tauri::command]
pub fn get_seasonal_patterns(state: State<'_, DbState>) -> Result<Vec<SeasonalPattern>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT calendar_month, CAST(AVG(monthly_total) AS REAL) as avg_spending
             FROM (
                 SELECT CAST(strftime('%m', t.date) AS INTEGER) as calendar_month,
                        strftime('%Y-%m', t.date) as period,
                        CAST(SUM({spending_amount}) AS REAL) / 100.0 as monthly_total
                 FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE ({spending_pred})
                   AND t.pending = 0
                   AND COALESCE(c.name, '') != 'Income'
                   AND {included_in_planning}
                   AND {no_transfer}
                 GROUP BY calendar_month, period
             )
             GROUP BY calendar_month
             ORDER BY calendar_month",
            spending_amount = spending_amount(),
            spending_pred = spending_pred(),
            included_in_planning = INCLUDED_IN_PLANNING,
            no_transfer = NO_TRANSFER,
        ))
        .map_err(|e| e.to_string())?;

    let monthly_data: Vec<(i32, f64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let annual_avg: f64 = if monthly_data.is_empty() {
        0.0
    } else {
        monthly_data.iter().map(|(_, avg)| avg).sum::<f64>() / monthly_data.len() as f64
    };

    let mut lookup: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
    for (month, avg) in &monthly_data {
        lookup.insert(*month, *avg);
    }

    let result = (1i32..=12)
        .map(|month| {
            let avg_spending = *lookup.get(&month).unwrap_or(&0.0);
            let vs_annual_avg = if annual_avg > 0.0 {
                (avg_spending - annual_avg) / annual_avg
            } else {
                0.0
            };
            SeasonalPattern {
                month,
                month_name: MONTH_NAMES[(month - 1) as usize].to_string(),
                avg_spending,
                vs_annual_avg,
            }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub fn calculate_debt_payoff(
    state: State<'_, DbState>,
    strategy: String,
    extra_monthly_cents: i64,
) -> Result<DebtPayoffPlan, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Load all active liabilities with balance and interest rate
    let mut stmt = conn
        .prepare(
            "SELECT id, name, current_balance_cents, interest_rate,
                    COALESCE(minimum_payment_cents, 0)
             FROM liabilities
             WHERE current_balance_cents > 0 AND interest_rate > 0",
        )
        .map_err(|e| e.to_string())?;

    // Intermediate struct for simulation
    struct DebtSim {
        id: String,
        name: String,
        initial_balance: f64,
        annual_rate: f64,
        min_payment: f64,
        balance: f64,
        total_interest: f64,
        payoff_date: Option<NaiveDate>,
        payments: Vec<DebtPayment>,
    }

    let mut debts: Vec<DebtSim> = stmt
        .query_map([], |row| {
            let balance_cents: i64 = row.get(2)?;
            let rate: f64 = row.get(3)?;
            let min_cents: i64 = row.get(4)?;
            let balance = balance_cents as f64 / 100.0;
            Ok(DebtSim {
                id: row.get(0)?,
                name: row.get(1)?,
                initial_balance: balance,
                annual_rate: rate,
                min_payment: min_cents as f64 / 100.0,
                balance,
                total_interest: 0.0,
                payoff_date: None,
                payments: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse liability row: {}", e);
                None
            }
        })
        .collect();

    if debts.is_empty() {
        let now = Utc::now().date_naive();
        return Ok(DebtPayoffPlan {
            strategy,
            total_interest: 0.0,
            payoff_date: now.format("%Y-%m-%d").to_string(),
            monthly_payment: extra_monthly_cents as f64 / 100.0,
            debts: vec![],
        });
    }

    // Sort by strategy
    match strategy.as_str() {
        "snowball" => {
            debts.sort_by(|a, b| {
                a.balance
                    .partial_cmp(&b.balance)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        }
        _ => {
            // avalanche: highest interest rate first
            debts.sort_by(|a, b| {
                b.annual_rate
                    .partial_cmp(&a.annual_rate)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        }
    }

    let extra_monthly = extra_monthly_cents as f64 / 100.0;
    let now = Utc::now().date_naive();
    let mut current_date =
        NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap_or(now);
    let mut freed_extra: f64 = 0.0;
    let max_months = 1200usize; // 100-year cap to prevent infinite loops

    for month_idx in 0..max_months {
        let all_paid = debts.iter().all(|d| d.balance <= 0.01);
        if all_paid {
            break;
        }

        if month_idx > 0 {
            current_date = add_months(current_date, 1);
        }
        let month_label = current_date.format("%Y-%m").to_string();

        // Target: first unpaid debt (ordered by strategy)
        let target_idx = debts
            .iter()
            .enumerate()
            .find(|(_, d)| d.balance > 0.01)
            .map(|(i, _)| i);

        let available_extra = extra_monthly + freed_extra;

        for i in 0..debts.len() {
            if debts[i].balance <= 0.01 {
                continue;
            }

            let monthly_rate = debts[i].annual_rate / 12.0;
            let interest = debts[i].balance * monthly_rate;
            debts[i].total_interest += interest;

            // Minimum payment, capped to outstanding balance + interest
            let mut payment = debts[i].min_payment.min(debts[i].balance + interest);

            // Apply extra to target debt
            if Some(i) == target_idx {
                payment = (payment + available_extra).min(debts[i].balance + interest);
            }

            let principal = (payment - interest).max(0.0);
            debts[i].balance = (debts[i].balance - principal).max(0.0);

            let remaining = debts[i].balance;
            debts[i].payments.push(DebtPayment {
                month: month_label.clone(),
                payment,
                principal,
                interest,
                remaining,
            });

            if debts[i].balance <= 0.01 && debts[i].payoff_date.is_none() {
                debts[i].payoff_date = Some(current_date);
                freed_extra += debts[i].min_payment;
            }
        }
    }

    let final_date = debts
        .iter()
        .filter_map(|d| d.payoff_date)
        .max()
        .unwrap_or(current_date);

    let total_interest: f64 = debts.iter().map(|d| d.total_interest).sum();
    let total_monthly =
        debts.iter().map(|d| d.min_payment).sum::<f64>() + extra_monthly;

    let debt_items: Vec<DebtPayoffItem> = debts
        .into_iter()
        .map(|d| DebtPayoffItem {
            liability_id: d.id,
            name: d.name,
            current_balance: d.initial_balance,
            interest_rate: d.annual_rate,
            payoff_date: d
                .payoff_date
                .map(|pd| pd.format("%Y-%m-%d").to_string())
                .unwrap_or_else(|| final_date.format("%Y-%m-%d").to_string()),
            total_interest: d.total_interest,
            monthly_payments: d.payments,
        })
        .collect();

    Ok(DebtPayoffPlan {
        strategy,
        total_interest,
        payoff_date: final_date.format("%Y-%m-%d").to_string(),
        monthly_payment: total_monthly,
        debts: debt_items,
    })
}
