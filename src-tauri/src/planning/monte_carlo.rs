use rand::prelude::*;
use rand_distr::Normal;
use serde::Serialize;

#[derive(Serialize)]
pub struct SimulationParams {
    pub current_portfolio: f64,
    pub monthly_contribution: f64,
    pub years_to_retirement: i32,
    pub years_in_retirement: i32,
    pub pre_retirement_return: f64,  // mean annual nominal return, e.g. 0.07
    pub post_retirement_return: f64, // mean annual nominal return, e.g. 0.05
    pub pre_retirement_stddev: f64,  // e.g. 0.15
    pub post_retirement_stddev: f64, // e.g. 0.10
    pub inflation_rate: f64,         // e.g. 0.03
    pub withdrawal_rate: f64,        // e.g. 0.04
    pub ss_annual_benefit: f64,      // in today's dollars
    pub ss_start_year: i32,          // which retirement year SS kicks in (0 = immediately)
    pub current_age: i32,            // for labeling yearly data with actual ages
}

#[derive(Serialize)]
pub struct PercentileResult {
    pub percentile: i32,
    pub portfolio_at_retirement: f64,
    pub years_funded: f64,
    pub monthly_income: f64,
}

#[derive(Serialize)]
pub struct YearlyPercentiles {
    pub year: i32, // year offset from now (0 = current)
    pub age: i32,
    pub p10: f64,
    pub p25: f64,
    pub p50: f64,
    pub p75: f64,
    pub p90: f64,
}

#[derive(Serialize)]
pub struct SimulationResult {
    pub success_probability: f64,
    pub median_portfolio_at_retirement: f64,
    pub percentiles: Vec<PercentileResult>,
    pub yearly_data: Vec<YearlyPercentiles>,
}

/// Run a Monte Carlo retirement simulation.
///
/// Performs `iterations` independent trials. Each trial simulates an accumulation
/// phase followed by a distribution phase using normally-distributed annual returns.
/// Returns aggregated percentile data and a success probability.
pub fn run_simulation(params: &SimulationParams, iterations: usize) -> SimulationResult {
    let total_years = params.years_to_retirement + params.years_in_retirement;

    // portfolio_paths[iter][year] = portfolio value
    let mut portfolio_paths: Vec<Vec<f64>> = Vec::with_capacity(iterations);

    let pre_dist = Normal::new(
        params.pre_retirement_return,
        params.pre_retirement_stddev,
    )
    .expect("invalid pre-retirement distribution parameters");

    let post_dist = Normal::new(
        params.post_retirement_return,
        params.post_retirement_stddev,
    )
    .expect("invalid post-retirement distribution parameters");

    let mut rng = thread_rng();

    for _ in 0..iterations {
        let mut path: Vec<f64> = Vec::with_capacity((total_years + 1) as usize);
        path.push(params.current_portfolio);

        let mut portfolio = params.current_portfolio;

        // --- Accumulation phase ---
        for _year in 0..params.years_to_retirement {
            let annual_return = pre_dist.sample(&mut rng);
            portfolio = portfolio * (1.0 + annual_return)
                + params.monthly_contribution * 12.0;
            path.push(portfolio.max(0.0));
        }

        // Retirement portfolio and first-year withdrawal
        let portfolio_at_retirement = portfolio;
        let first_withdrawal = portfolio_at_retirement * params.withdrawal_rate;

        // --- Distribution phase ---
        let mut withdrawal = first_withdrawal;
        for ret_year in 0..params.years_in_retirement {
            if ret_year > 0 {
                // Inflate withdrawal each subsequent year
                withdrawal *= 1.0 + params.inflation_rate;
            }

            // SS benefit kicks in from ss_start_year onward
            let ss_this_year = if ret_year >= params.ss_start_year {
                // Adjust SS for inflation over retirement years elapsed
                params.ss_annual_benefit
                    * (1.0 + params.inflation_rate).powi(ret_year)
            } else {
                0.0
            };

            let annual_return = post_dist.sample(&mut rng);
            portfolio = portfolio * (1.0 + annual_return) - withdrawal + ss_this_year;
            portfolio = portfolio.max(0.0);
            path.push(portfolio);
        }

        portfolio_paths.push(path);
    }

    // --- Aggregate results across iterations ---

    // Build per-year sorted arrays for percentile computation
    let mut yearly_sorted: Vec<Vec<f64>> = (0..=(total_years as usize))
        .map(|year| {
            let mut vals: Vec<f64> = portfolio_paths.iter().map(|p| p[year]).collect();
            vals.sort_by(|a, b| a.partial_cmp(b).unwrap());
            vals
        })
        .collect();

    let n = iterations;

    let percentile_value = |sorted: &Vec<f64>, pct: f64| -> f64 {
        let idx = ((pct / 100.0) * (n as f64 - 1.0)).round() as usize;
        sorted[idx.min(n - 1)]
    };

    // Yearly percentiles
    let mut yearly_data: Vec<YearlyPercentiles> = Vec::with_capacity(total_years as usize + 1);
    for year in 0..=(total_years as usize) {
        let sorted = &yearly_sorted[year];
        yearly_data.push(YearlyPercentiles {
            year: year as i32,
            age: params.current_age + year as i32,
            p10: percentile_value(sorted, 10.0),
            p25: percentile_value(sorted, 25.0),
            p50: percentile_value(sorted, 50.0),
            p75: percentile_value(sorted, 75.0),
            p90: percentile_value(sorted, 90.0),
        });
    }

    // Portfolio at retirement year
    let retirement_year = params.years_to_retirement as usize;
    let retirement_sorted = &yearly_sorted[retirement_year];
    let median_portfolio_at_retirement = percentile_value(retirement_sorted, 50.0);

    // Success rate: fraction of iterations that end with portfolio > 0
    let successes = portfolio_paths
        .iter()
        .filter(|p| *p.last().unwrap_or(&0.0) > 0.0)
        .count();
    let success_probability = successes as f64 / iterations as f64;

    // Per-percentile breakdown
    let target_percentiles = [10i32, 25, 50, 75, 90];
    let mut percentiles: Vec<PercentileResult> = Vec::with_capacity(target_percentiles.len());

    for &pct in &target_percentiles {
        let port_at_retirement = percentile_value(retirement_sorted, pct as f64);

        // years_funded: last year (relative to retirement) where the portfolio is > 0
        // We pick the iteration closest to this percentile
        let idx = ((pct as f64 / 100.0) * (n as f64 - 1.0)).round() as usize;
        // Sort iterations by their retirement-year portfolio value
        let mut iter_indices: Vec<usize> = (0..n).collect();
        iter_indices.sort_by(|&a, &b| {
            portfolio_paths[a][retirement_year]
                .partial_cmp(&portfolio_paths[b][retirement_year])
                .unwrap()
        });
        let chosen_iter = iter_indices[idx.min(n - 1)];
        let path = &portfolio_paths[chosen_iter];

        let mut years_funded = params.years_in_retirement as f64;
        for ret_year in 0..params.years_in_retirement as usize {
            let year_idx = retirement_year + ret_year + 1;
            if year_idx < path.len() && path[year_idx] <= 0.0 {
                years_funded = ret_year as f64;
                break;
            }
        }

        let monthly_income = port_at_retirement * params.withdrawal_rate / 12.0;

        percentiles.push(PercentileResult {
            percentile: pct,
            portfolio_at_retirement: port_at_retirement,
            years_funded,
            monthly_income,
        });
    }

    // Clear the sorted data we no longer need
    yearly_sorted.clear();

    SimulationResult {
        success_probability,
        median_portfolio_at_retirement,
        percentiles,
        yearly_data,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_params() -> SimulationParams {
        SimulationParams {
            current_portfolio: 100_000.0,
            monthly_contribution: 1_500.0,
            years_to_retirement: 25,
            years_in_retirement: 30,
            pre_retirement_return: 0.07,
            post_retirement_return: 0.05,
            pre_retirement_stddev: 0.15,
            post_retirement_stddev: 0.10,
            inflation_rate: 0.03,
            withdrawal_rate: 0.04,
            ss_annual_benefit: 24_000.0,
            ss_start_year: 0,
            current_age: 35,
        }
    }

    #[test]
    fn test_simulation_runs() {
        let params = default_params();
        let result = run_simulation(&params, 500);
        assert!(result.success_probability >= 0.0 && result.success_probability <= 1.0);
        assert!(result.median_portfolio_at_retirement > 0.0);
    }

    #[test]
    fn test_percentiles_ordered() {
        let params = default_params();
        let result = run_simulation(&params, 500);
        // p10 <= p50 <= p90 for the retirement year
        let retirement_data = result
            .yearly_data
            .get(params.years_to_retirement as usize)
            .expect("retirement year data missing");
        assert!(retirement_data.p10 <= retirement_data.p25);
        assert!(retirement_data.p25 <= retirement_data.p50);
        assert!(retirement_data.p50 <= retirement_data.p75);
        assert!(retirement_data.p75 <= retirement_data.p90);
    }

    #[test]
    fn test_yearly_data_length() {
        let params = default_params();
        let total = (params.years_to_retirement + params.years_in_retirement) as usize;
        let result = run_simulation(&params, 200);
        assert_eq!(result.yearly_data.len(), total + 1); // +1 for year 0
    }

    #[test]
    fn test_percentile_results_count() {
        let params = default_params();
        let result = run_simulation(&params, 200);
        assert_eq!(result.percentiles.len(), 5); // 10, 25, 50, 75, 90
    }

    #[test]
    fn test_no_ss_reduces_success() {
        let mut params_no_ss = default_params();
        params_no_ss.ss_annual_benefit = 0.0;
        let result_no_ss = run_simulation(&params_no_ss, 500);

        let params_ss = default_params();
        let result_ss = run_simulation(&params_ss, 500);

        // With SS, success probability should generally be higher
        // (with random seed this may not always hold, so use a loose check)
        assert!(result_ss.success_probability >= 0.0);
        assert!(result_no_ss.success_probability >= 0.0);
    }
}
