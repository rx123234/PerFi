// 2025 Federal contribution limits (stored in cents)
pub const LIMIT_401K_2025: i64 = 23_500_00;
pub const LIMIT_401K_CATCHUP_2025: i64 = 7_500_00;
pub const LIMIT_IRA_2025: i64 = 7_000_00;
pub const LIMIT_IRA_CATCHUP_2025: i64 = 1_000_00;
pub const LIMIT_HSA_SINGLE_2025: i64 = 4_300_00;
pub const LIMIT_HSA_FAMILY_2025: i64 = 8_550_00;
pub const STANDARD_DEDUCTION_SINGLE_2025: i64 = 15_000_00;
pub const STANDARD_DEDUCTION_MFJ_2025: i64 = 30_000_00;

struct Bracket {
    rate: f64,
    lower: f64,
    upper: f64, // f64::INFINITY for top bracket
}

fn single_brackets() -> Vec<Bracket> {
    vec![
        Bracket { rate: 0.10, lower: 0.0,       upper: 11_925.0 },
        Bracket { rate: 0.12, lower: 11_925.0,  upper: 48_475.0 },
        Bracket { rate: 0.22, lower: 48_475.0,  upper: 103_350.0 },
        Bracket { rate: 0.24, lower: 103_350.0, upper: 197_300.0 },
        Bracket { rate: 0.32, lower: 197_300.0, upper: 250_525.0 },
        Bracket { rate: 0.35, lower: 250_525.0, upper: 626_350.0 },
        Bracket { rate: 0.37, lower: 626_350.0, upper: f64::INFINITY },
    ]
}

fn mfj_brackets() -> Vec<Bracket> {
    vec![
        Bracket { rate: 0.10, lower: 0.0,       upper: 23_850.0 },
        Bracket { rate: 0.12, lower: 23_850.0,  upper: 96_950.0 },
        Bracket { rate: 0.22, lower: 96_950.0,  upper: 206_700.0 },
        Bracket { rate: 0.24, lower: 206_700.0, upper: 394_600.0 },
        Bracket { rate: 0.32, lower: 394_600.0, upper: 501_050.0 },
        Bracket { rate: 0.35, lower: 501_050.0, upper: 751_600.0 },
        Bracket { rate: 0.37, lower: 751_600.0, upper: f64::INFINITY },
    ]
}

fn brackets_for(filing_status: &str) -> Vec<Bracket> {
    match filing_status.to_lowercase().as_str() {
        "mfj" | "married" | "married_filing_jointly" => mfj_brackets(),
        _ => single_brackets(),
    }
}

/// Walk progressive brackets and return total federal income tax owed.
pub fn estimate_federal_tax(taxable_income: f64, filing_status: &str) -> f64 {
    if taxable_income <= 0.0 {
        return 0.0;
    }
    let brackets = brackets_for(filing_status);
    let mut tax = 0.0;
    for bracket in &brackets {
        if taxable_income <= bracket.lower {
            break;
        }
        let taxable_in_bracket = taxable_income.min(bracket.upper) - bracket.lower;
        tax += taxable_in_bracket * bracket.rate;
    }
    tax
}

/// Format a dollar amount with comma-separated thousands, no decimals.
/// e.g. 48475.0 → "48,475"
fn format_dollars(amount: f64) -> String {
    let whole = amount as u64;
    let s = whole.to_string();
    let mut result = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push(',');
        }
        result.push(ch);
    }
    result.chars().rev().collect()
}

/// Return a description of the marginal bracket for the given income.
/// Example: "22% ($48,475 - $103,350)"
pub fn get_marginal_bracket(taxable_income: f64, filing_status: &str) -> String {
    let brackets = brackets_for(filing_status);
    for bracket in &brackets {
        if taxable_income <= bracket.upper {
            let pct = (bracket.rate * 100.0) as u32;
            if bracket.upper.is_infinite() {
                return format!("{}% (${}+)", pct, format_dollars(bracket.lower));
            } else {
                return format!(
                    "{}% (${} - ${})",
                    pct,
                    format_dollars(bracket.lower),
                    format_dollars(bracket.upper)
                );
            }
        }
    }
    // Fallback: top bracket
    let top = brackets.last().unwrap();
    let pct = (top.rate * 100.0) as u32;
    format!("{}% (${}+)", pct, format_dollars(top.lower))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zero_income() {
        assert_eq!(estimate_federal_tax(0.0, "single"), 0.0);
    }

    #[test]
    fn test_single_10pct_only() {
        // $10,000 is entirely in the 10% bracket
        let tax = estimate_federal_tax(10_000.0, "single");
        assert!((tax - 1_000.0).abs() < 0.01);
    }

    #[test]
    fn test_single_spans_two_brackets() {
        // $20,000: first $11,925 at 10%, rest at 12%
        let expected = 11_925.0 * 0.10 + (20_000.0 - 11_925.0) * 0.12;
        let tax = estimate_federal_tax(20_000.0, "single");
        assert!((tax - expected).abs() < 0.01);
    }

    #[test]
    fn test_marginal_bracket_single() {
        let bracket = get_marginal_bracket(50_000.0, "single");
        assert!(bracket.starts_with("22%"));
    }

    #[test]
    fn test_marginal_bracket_mfj() {
        let bracket = get_marginal_bracket(100_000.0, "mfj");
        assert!(bracket.starts_with("22%"));
    }

    #[test]
    fn test_top_bracket() {
        let bracket = get_marginal_bracket(700_000.0, "single");
        assert!(bracket.starts_with("37%"));
        assert!(bracket.contains('+'));
    }
}
