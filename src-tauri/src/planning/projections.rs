/// Compound growth: FV = PV * (1 + rate)^years
pub fn future_value(present_value: f64, rate: f64, years: i32) -> f64 {
    present_value * (1.0 + rate).powi(years)
}

/// Required monthly savings to reach a target given a current balance and annual rate over years.
///
/// Uses the future-value-of-annuity formula:
///   FV_annuity = PMT * [((1+r)^n - 1) / r]  (where r is the monthly rate, n is months)
///   target = current * (1+r)^n + PMT * [((1+r)^n - 1) / r]
///   PMT = (target - current * (1+r)^n) / [((1+r)^n - 1) / r]
///
/// Returns 0.0 if the current balance already meets or exceeds the target.
pub fn monthly_savings_to_target(target: f64, current: f64, rate: f64, years: i32) -> f64 {
    let months = years * 12;
    let monthly_rate = rate / 12.0;
    let n = months as f64;

    let growth_factor = (1.0 + monthly_rate).powf(n);
    let future_current = current * growth_factor;

    if future_current >= target {
        return 0.0;
    }

    let gap = target - future_current;

    if monthly_rate.abs() < 1e-10 {
        // No return: simple division
        gap / n
    } else {
        let annuity_factor = (growth_factor - 1.0) / monthly_rate;
        gap / annuity_factor
    }
}

/// Adjust a Social Security benefit for the actual claiming age vs. Full Retirement Age (FRA).
///
/// Before FRA:
///   - -6.67% per year for the first 3 years early (up to 36 months)
///   - -5.00% per year for additional years early (months 37-60)
/// After FRA:
///   - +8.00% per year in delayed credits, up to age 70
pub fn ss_benefit_at_age(fra_monthly_benefit: f64, claiming_age: i32, fra_age: i32) -> f64 {
    if claiming_age == fra_age {
        return fra_monthly_benefit;
    }

    if claiming_age > fra_age {
        // Delayed credits: +8%/year, capped at age 70
        let delay_years = (claiming_age - fra_age).min(70 - fra_age) as f64;
        return fra_monthly_benefit * (1.0 + 0.08 * delay_years);
    }

    // Early claiming reduction
    let years_early = (fra_age - claiming_age) as f64;
    let months_early = years_early * 12.0;

    // First 36 months: -5/9% per month (~6.67%/year)
    // Months 37+: -5/12% per month (~5%/year)
    let reduction = if months_early <= 36.0 {
        (5.0 / 9.0) / 100.0 * months_early
    } else {
        let first_tier = (5.0 / 9.0) / 100.0 * 36.0;
        let second_tier = (5.0 / 12.0) / 100.0 * (months_early - 36.0);
        first_tier + second_tier
    };

    fra_monthly_benefit * (1.0 - reduction)
}

/// Break-even age: the age at which cumulative lifetime benefits from claiming late
/// first equals (or exceeds) the cumulative benefits from claiming early.
///
/// Both early and late benefits are computed via `ss_benefit_at_age`.
/// The break-even is found by iterating month by month until late > early cumulatively.
/// Returns the break-even age in whole years (rounded down).
/// If no break-even is found within 100 years, returns 100.
pub fn ss_break_even_age(fra_benefit: f64, early_age: i32, late_age: i32, fra_age: i32) -> i32 {
    let early_monthly = ss_benefit_at_age(fra_benefit, early_age, fra_age);
    let late_monthly = ss_benefit_at_age(fra_benefit, late_age, fra_age);

    // Accumulate from the late claiming age onward
    // Early claimant has a head start of (late_age - early_age) years of benefits
    let head_start_months = (late_age - early_age) * 12;
    let early_head_start = early_monthly * head_start_months as f64;

    // From late_age onward, find when late_cumulative catches early_cumulative
    // early_cumulative(m) = early_head_start + early_monthly * m
    // late_cumulative(m)  = late_monthly * m
    // Break even when late_monthly * m >= early_head_start + early_monthly * m
    // (late_monthly - early_monthly) * m >= early_head_start
    // m >= early_head_start / (late_monthly - early_monthly)

    let diff = late_monthly - early_monthly;
    if diff <= 0.0 {
        // Late benefit is not higher than early — no break-even (or immediate)
        return late_age;
    }

    let months_after_late = (early_head_start / diff).ceil() as i32;
    let break_even_age_months = late_age * 12 + months_after_late;
    let break_even_age = break_even_age_months / 12;

    break_even_age.min(100)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_future_value() {
        // $10,000 at 7% for 10 years
        let fv = future_value(10_000.0, 0.07, 10);
        assert!((fv - 19_671.51).abs() < 1.0);
    }

    #[test]
    fn test_future_value_zero_rate() {
        let fv = future_value(5_000.0, 0.0, 20);
        assert!((fv - 5_000.0).abs() < 0.01);
    }

    #[test]
    fn test_monthly_savings_already_met() {
        // Current balance exceeds target at any positive return
        let pmt = monthly_savings_to_target(100_000.0, 200_000.0, 0.07, 10);
        assert_eq!(pmt, 0.0);
    }

    #[test]
    fn test_monthly_savings_positive() {
        // Some savings required
        let pmt = monthly_savings_to_target(1_000_000.0, 0.0, 0.07, 30);
        assert!(pmt > 0.0 && pmt < 1_000.0);
    }

    #[test]
    fn test_ss_benefit_at_fra() {
        let benefit = ss_benefit_at_age(2_000.0, 67, 67);
        assert!((benefit - 2_000.0).abs() < 0.01);
    }

    #[test]
    fn test_ss_benefit_delayed() {
        // 3 years delayed: +24%
        let benefit = ss_benefit_at_age(2_000.0, 70, 67);
        assert!((benefit - 2_480.0).abs() < 0.01);
    }

    #[test]
    fn test_ss_benefit_early() {
        // 3 years early from FRA 67 → claiming at 64
        // 36 months * 5/9% = 20% reduction
        let benefit = ss_benefit_at_age(2_000.0, 64, 67);
        assert!((benefit - 1_600.0).abs() < 0.01);
    }

    #[test]
    fn test_break_even_age_reasonable() {
        // Typically break-even is in the early-to-mid 80s
        let age = ss_break_even_age(2_000.0, 62, 67, 67);
        assert!(age > 70 && age < 90);
    }
}
