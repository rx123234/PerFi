use crate::db::DbState;
use crate::models::Asset;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportedHolding {
    pub account_name: String,
    pub account_number: String,
    pub account_type: String,
    pub symbol: String,
    pub description: String,
    pub quantity: f64,
    pub price: f64,
    pub ending_value_cents: i64,
    pub cost_basis_cents: Option<i64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InvestmentImportResult {
    pub holdings: Vec<ImportedHolding>,
    pub created: usize,
    pub updated: usize,
    pub skipped: usize,
}

/// Parse a dollar string like "99752.01" or "unavailable" or "not applicable" into Option<cents>
fn parse_dollar_value(s: &str) -> Option<i64> {
    let trimmed = s.trim().replace(",", "");
    if trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case("unavailable")
        || trimmed.eq_ignore_ascii_case("not applicable")
    {
        return None;
    }
    trimmed.parse::<f64>().ok().map(|v| (v * 100.0).round() as i64)
}

/// Parse quantity string like "193.64800"
fn parse_quantity(s: &str) -> Option<f64> {
    s.trim().replace(",", "").parse::<f64>().ok()
}

/// Parse a Fidelity statement CSV and extract holdings
fn parse_fidelity_statement(content: &str) -> Result<Vec<ImportedHolding>, String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut holdings = Vec::new();

    // Phase 1: Parse account summary section (first few lines) to build account name map
    // Format: Account Type, Account, Beginning mkt Value, ...
    let mut account_names: std::collections::HashMap<String, (String, String)> = std::collections::HashMap::new();

    let mut i = 0;
    // Skip header line
    if lines.get(0).map_or(false, |l| l.starts_with("Account Type")) {
        i = 1;
    }

    // Read account summary rows until we hit an empty/blank line or the holdings header
    while i < lines.len() {
        let line = lines[i].trim();
        if line.is_empty() || line.starts_with("Symbol") {
            break;
        }
        // Parse: Account Type, Account Number, ...
        let parts: Vec<&str> = line.splitn(3, ',').collect();
        if parts.len() >= 2 {
            let account_type = parts[0].trim().to_string();
            let account_num = parts[1].trim().to_string();
            if !account_num.is_empty() && account_num != "Account" {
                account_names.insert(
                    account_num.clone(),
                    (account_type, account_num),
                );
            }
        }
        i += 1;
    }

    // Phase 2: Parse holdings section
    // Look for "Symbol/CUSIP" header
    while i < lines.len() {
        if lines[i].trim().starts_with("Symbol/CUSIP") || lines[i].trim().starts_with("Symbol") {
            i += 1; // skip header
            break;
        }
        i += 1;
    }

    // Now parse holdings, tracking current account
    let mut current_account_num = String::new();
    let mut current_section = String::new(); // "Stocks", "Core Account", etc.

    while i < lines.len() {
        let line = lines[i].trim();
        i += 1;

        if line.is_empty() {
            continue;
        }

        // Check if this is an account number line (just a number, no commas in the meaningful part)
        // Account numbers appear alone on a line like "Z28819908" or "224531581"
        let comma_count = line.matches(',').count();
        if comma_count == 0 && !line.is_empty() && !line.starts_with("Subtotal") {
            // Could be an account number or a section header like "Stocks" or "Core Account"
            let lower = line.to_lowercase();
            if lower == "stocks" || lower == "core account" || lower == "bonds"
                || lower == "mutual funds" || lower == "etfs" || lower == "options"
            {
                current_section = line.to_string();
            } else {
                // Assume it's an account number
                current_account_num = line.to_string();
                current_section.clear();
            }
            continue;
        }

        // Skip subtotal lines
        if line.starts_with("Subtotal") {
            continue;
        }

        // Try to parse as a holding line:
        // Symbol,Description,Quantity,Price,Beginning Value,Ending Value,Cost Basis
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 6 {
            let symbol = parts[0].trim();
            if symbol.is_empty() || symbol.starts_with("Subtotal") {
                continue;
            }

            let description = parts[1].trim();
            let quantity = match parse_quantity(parts[2]) {
                Some(q) => q,
                None => continue,
            };
            let price = match parse_quantity(parts[3]) {
                Some(p) => p,
                None => continue,
            };
            // parts[4] = Beginning Value (skip)
            let ending_value = match parse_dollar_value(parts[5]) {
                Some(v) => v,
                None => {
                    // Compute from quantity * price
                    (quantity * price * 100.0).round() as i64
                }
            };
            let cost_basis = if parts.len() > 6 {
                parse_dollar_value(parts[6])
            } else {
                None
            };

            // Look up account info
            let (account_type, account_name) = account_names
                .get(&current_account_num)
                .map(|(t, n)| (t.clone(), format!("{} ({})", t, n)))
                .unwrap_or_else(|| ("Investment".to_string(), current_account_num.clone()));

            // Determine tax treatment from account type
            let tax_treatment = determine_tax_treatment(&account_type);

            holdings.push(ImportedHolding {
                account_name,
                account_number: current_account_num.clone(),
                account_type: tax_treatment,
                symbol: symbol.to_string(),
                description: description.to_string(),
                quantity,
                price,
                ending_value_cents: ending_value,
                cost_basis_cents: cost_basis,
            });
        }
    }

    Ok(holdings)
}

fn determine_tax_treatment(account_type: &str) -> String {
    let lower = account_type.to_lowercase();
    if lower.contains("ira") && lower.contains("roth") {
        "roth".to_string()
    } else if lower.contains("ira") || lower.contains("rollover") {
        "traditional".to_string()
    } else if lower.contains("401") {
        "traditional".to_string()
    } else if lower.contains("529") {
        "529".to_string()
    } else if lower.contains("hsa") {
        "hsa".to_string()
    } else if lower.contains("custodial") {
        "taxable".to_string()
    } else {
        "taxable".to_string()
    }
}

/// Parse a Vanguard PDF statement text into holdings
fn parse_vanguard_pdf(text: &str) -> Result<Vec<ImportedHolding>, String> {
    let lines: Vec<&str> = text.lines().collect();
    let mut holdings = Vec::new();

    // Detect account type and number from text like:
    // "Roth IRA brokerage account—XXXX1662"
    let mut account_type = "Investment".to_string();
    let mut account_number = String::new();
    let mut account_name = String::new();

    for line in &lines {
        let line = line.trim();
        if line.contains("brokerage account") && line.contains("XXXX") {
            // Extract account type
            if line.to_lowercase().contains("roth ira") {
                account_type = "roth".to_string();
                account_name = "Roth IRA".to_string();
            } else if line.to_lowercase().contains("traditional ira") || line.to_lowercase().contains("rollover ira") {
                account_type = "traditional".to_string();
                account_name = "Traditional IRA".to_string();
            } else {
                account_type = "taxable".to_string();
                account_name = "Brokerage".to_string();
            }
            // Extract account number (XXXX1662)
            if let Some(pos) = line.find("XXXX") {
                account_number = line[pos..].trim().to_string();
                // Clean trailing whitespace/punctuation
                account_number = account_number.split_whitespace().next().unwrap_or("").to_string();
            }
            break;
        }
    }
    if account_name.is_empty() {
        account_name = "Vanguard Account".to_string();
    }

    // Parse holdings sections: "Sweep program", "ETFs", "Stocks"
    // Format (PDF text extraction produces lines like):
    // SYMBOL
    // QUANTITY  PRICE  BALANCE_PREV  BALANCE_CURRENT
    // NAME
    // or sometimes:
    // SYMBOL  QUANTITY  PRICE  BALANCE_PREV  BALANCE_CURRENT
    // NAME

    let mut i = 0;
    let mut in_holdings_section = false;
    let mut current_section = String::new();

    while i < lines.len() {
        let line = lines[i].trim();
        i += 1;

        // Detect section headers
        if line == "Sweep program" || line == "ETFs" || line == "Stocks" || line == "Bonds" || line == "Mutual Funds" {
            current_section = line.to_string();
            in_holdings_section = true;
            continue;
        }

        // Stop at transaction sections
        if line.starts_with("Account activity") || line.starts_with("Completed transactions") || line.starts_with("Income summary") {
            in_holdings_section = false;
            continue;
        }

        if !in_holdings_section {
            continue;
        }

        // Skip headers and metadata lines
        if line.starts_with("Symbol") || line.starts_with("Name") || line.starts_with("Quantity")
            || line.starts_with("Total") || line.starts_with("Balances and holdings")
            || line.starts_with("To get") || line.contains("continued")
            || line.is_empty() || line.starts_with("Your securities")
            || line.starts_with("7-day") || line.starts_with("Page")
            || line.starts_with("Price on") || line.starts_with("Balance on")
            || line.contains("statement") || line.contains("Vanguard Personal")
            || line.contains("877-662") || line.contains("STMT")
        {
            continue;
        }

        // Try to parse a holding. The PDF text format varies, but typically:
        // Line with symbol-like token (all caps, 1-5 chars) followed by numbers
        // Then a description line

        // Check if this line starts with what looks like a ticker or quantity
        let tokens: Vec<&str> = line.split_whitespace().collect();
        if tokens.is_empty() {
            continue;
        }

        // For sweep/money market: "8,889.7800 $1.00 $8,865.33 $8,889.78"
        // The name follows on the next line(s)
        if current_section == "Sweep program" {
            // Look for the quantity line (starts with a number)
            if let Some(qty) = parse_number_token(tokens[0]) {
                let price = if tokens.len() > 1 { parse_dollar_token(tokens[1]) } else { Some(1.0) };
                let ending_value = if tokens.len() > 3 { parse_dollar_token(tokens[3]) } else { None };

                // Collect name from next lines
                let mut name_parts = Vec::new();
                while i < lines.len() {
                    let next = lines[i].trim();
                    if next.is_empty() || next.starts_with("Total") || next.starts_with("7-day") {
                        if next.starts_with("7-day") { i += 1; }
                        break;
                    }
                    name_parts.push(next);
                    i += 1;
                }
                let name = name_parts.join(" ");

                if !name.is_empty() {
                    let value_cents = ending_value
                        .map(|v| (v * 100.0).round() as i64)
                        .unwrap_or((qty * price.unwrap_or(1.0) * 100.0).round() as i64);

                    holdings.push(ImportedHolding {
                        account_name: format!("{} ({})", account_name, account_number),
                        account_number: account_number.clone(),
                        account_type: account_type.clone(),
                        symbol: "SWEEP".to_string(),
                        description: name,
                        quantity: qty,
                        price: price.unwrap_or(1.0),
                        ending_value_cents: value_cents,
                        cost_basis_cents: None,
                    });
                }
                continue;
            }
        }

        // For ETFs and Stocks sections:
        // Pattern: SYMBOL on one line, then "quantity price prev_bal end_bal" on next, then name
        // OR: SYMBOL quantity price prev_bal end_bal on one line, then name

        let first_token = tokens[0];
        let looks_like_ticker = first_token.len() <= 5
            && first_token.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
            && first_token.chars().any(|c| c.is_ascii_uppercase());

        if !looks_like_ticker {
            continue;
        }

        let symbol = first_token.to_string();

        // Check if numbers follow on the same line
        let (quantity, price, ending_value) = if tokens.len() >= 4 {
            // SYMBOL QTY PRICE PREV_BAL END_BAL
            let qty = parse_number_token(tokens[1]);
            let prc = parse_dollar_token(tokens[2]);
            let end = if tokens.len() >= 5 {
                parse_dollar_token(tokens[4]).or_else(|| parse_dollar_token(tokens[3]))
            } else {
                parse_dollar_token(tokens[3])
            };
            if qty.is_some() && prc.is_some() {
                (qty, prc, end)
            } else {
                // Numbers are on the next line
                (None, None, None)
            }
        } else {
            (None, None, None)
        };

        let (quantity, price, ending_value) = if quantity.is_none() {
            // Look for numbers on the next line
            if i < lines.len() {
                let num_line = lines[i].trim();
                let num_tokens: Vec<&str> = num_line.split_whitespace().collect();
                if num_tokens.len() >= 3 {
                    let qty = parse_number_token(num_tokens[0]);
                    let prc = parse_dollar_token(num_tokens[1]);
                    let end = if num_tokens.len() >= 4 {
                        parse_dollar_token(num_tokens[3]).or_else(|| parse_dollar_token(num_tokens[2]))
                    } else {
                        parse_dollar_token(num_tokens[2])
                    };
                    if qty.is_some() && prc.is_some() {
                        i += 1;
                        (qty, prc, end)
                    } else {
                        continue;
                    }
                } else {
                    continue;
                }
            } else {
                continue;
            }
        } else {
            (quantity, price, ending_value)
        };

        let quantity = match quantity {
            Some(q) => q,
            None => continue,
        };
        let price = match price {
            Some(p) => p,
            None => continue,
        };

        // Collect description from following lines (until next ticker or section)
        let mut name_parts = Vec::new();
        while i < lines.len() {
            let next = lines[i].trim();
            if next.is_empty() {
                break;
            }
            // Stop if next line looks like a ticker or section header
            let next_tokens: Vec<&str> = next.split_whitespace().collect();
            let next_is_ticker = next_tokens.len() <= 1
                && next_tokens.get(0).map_or(false, |t| {
                    t.len() <= 5 && t.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
                        && t.chars().any(|c| c.is_ascii_uppercase())
                });
            if next_is_ticker || next == "Stocks" || next == "ETFs" || next == "Bonds"
                || next.starts_with("Account activity") || next.starts_with("Total")
                || next.starts_with("$") || next.starts_with("Page ")
                || next.contains("statement") || next.contains("Vanguard Personal")
                || next.contains("877-662") || next.contains("STMT")
            {
                break;
            }
            // Check if this line is numbers (next holding's data line)
            if parse_number_token(next_tokens[0]).is_some() && next_tokens.len() >= 3 {
                break;
            }
            name_parts.push(next);
            i += 1;
        }
        let description = name_parts.join(" ");

        let value_cents = ending_value
            .map(|v| (v * 100.0).round() as i64)
            .unwrap_or((quantity * price * 100.0).round() as i64);

        holdings.push(ImportedHolding {
            account_name: format!("{} ({})", account_name, account_number),
            account_number: account_number.clone(),
            account_type: account_type.clone(),
            symbol,
            description,
            quantity,
            price,
            ending_value_cents: value_cents,
            cost_basis_cents: None,
        });
    }

    Ok(holdings)
}

fn parse_number_token(s: &str) -> Option<f64> {
    let cleaned = s.replace(",", "").replace("$", "");
    cleaned.parse::<f64>().ok()
}

fn parse_dollar_token(s: &str) -> Option<f64> {
    let cleaned = s.replace(",", "").replace("$", "");
    cleaned.parse::<f64>().ok()
}

/// Parse a Fidelity NetBenefits 401(k) PDF statement.
///
/// pdf-extract produces lines like:
///   L068: "DF A  Emrg"                                          <- fund name part 1 (text only)
///   L069: "Mkt Core Eq 348.287 352.257 $33.13 $29.90 $11,538.75 $10,532.48"  <- name part 2 + all 6 numbers
///
/// So: fund name spans 1-2 lines, and the LAST name line also contains the numeric data.
/// Category headers like "International", "Small Cap", "Mid-Cap", "Large Cap" have NO numbers.
fn parse_netbenefits_pdf(text: &str) -> Result<Vec<ImportedHolding>, String> {
    let lines: Vec<&str> = text.lines().collect();
    let mut holdings = Vec::new();

    // Extract plan name
    let mut account_name = "401(k)".to_string();
    for line in &lines {
        let line = line.trim();
        if line.contains("401(k)") {
            account_name = line.to_string();
            if account_name.len() > 60 {
                account_name = account_name[..60].to_string();
            }
            break;
        }
    }

    fn is_noise(line: &str) -> bool {
        let l = line.trim();
        l.is_empty()
            || l.trim_start().is_empty()
            || l.starts_with("Tier")
            || l.starts_with("Investment ")
            || l == "Investment"
            || l.starts_with("Shares as of")
            || l.starts_with("Price as of")
            || l.starts_with("Market Value as")
            || l.starts_with("Market Value of")
            || (l.starts_with("of ") && l.contains("/"))
            || l.starts_with("Statement Period")
            || l.starts_with("Displayed in this")
            || l.starts_with("Stock $")
            || l.starts_with("Account Totals")
    }

    fn is_category(line: &str) -> bool {
        let l = line.trim().to_lowercase();
        matches!(l.as_str(),
            "international" | "small cap" | "mid-cap" | "large cap"
            | "bond" | "short-term" | "target date" | "balanced"
        )
    }

    /// Check if a line contains numeric data (at least 2 numbers or dollar amounts)
    fn has_numeric_data(line: &str) -> bool {
        let tokens: Vec<&str> = line.split_whitespace().collect();
        let num_count = tokens.iter().filter(|t| {
            let cleaned = t.replace(",", "").replace("$", "").replace("(", "").replace(")", "");
            cleaned.parse::<f64>().is_ok() && cleaned.len() > 1
        }).count();
        num_count >= 2
    }

    /// Extract numbers from the end of a line, return (text_part, numbers)
    fn split_text_and_numbers(line: &str) -> (String, Vec<f64>) {
        let tokens: Vec<&str> = line.split_whitespace().collect();
        // Scan from the end to find where numbers start
        let mut first_num_idx = tokens.len();
        for j in (0..tokens.len()).rev() {
            let cleaned = tokens[j].replace(",", "").replace("$", "")
                .replace("(", "").replace(")", "").replace(" ", "");
            if cleaned.parse::<f64>().is_ok() && cleaned.len() > 1 {
                first_num_idx = j;
            } else {
                break;
            }
        }
        let text_part = tokens[..first_num_idx].join(" ");
        let nums: Vec<f64> = tokens[first_num_idx..].iter()
            .filter_map(|t| {
                let cleaned = t.replace(",", "").replace("$", "")
                    .replace("(", "").replace(")", "");
                cleaned.parse::<f64>().ok()
            })
            .collect();
        (text_part, nums)
    }

    // Find "Market Value of Your Account" section
    let mut i = 0;
    while i < lines.len() {
        if lines[i].contains("Market Value of Your Account") {
            i += 1;
            break;
        }
        i += 1;
    }

    let mut pending_name: Option<String> = None;

    while i < lines.len() {
        let line = lines[i].trim();
        i += 1;

        if line.starts_with("Account Totals") || line.starts_with("Remember that") {
            break;
        }

        if is_noise(line) || is_category(line) {
            pending_name = None;
            continue;
        }

        if has_numeric_data(line) {
            // This line has numbers — extract text prefix as name part, numbers as data
            let (text_part, nums) = split_text_and_numbers(line);

            // Build full fund name from pending + this line's text
            let fund_name = if let Some(ref pending) = pending_name {
                format!("{} {}", pending, text_part)
            } else {
                text_part
            };
            pending_name = None;

            // We expect 6 numbers: shares_start, shares_end, price_start, price_end, value_start, value_end
            if nums.len() >= 6 {
                let shares_end = nums[1];
                let price_end = nums[3];
                let value_end = nums[5];

                let clean_name = fund_name.split_whitespace().collect::<Vec<&str>>().join(" ");

                holdings.push(ImportedHolding {
                    account_name: account_name.clone(),
                    account_number: "401k".to_string(),
                    account_type: "traditional".to_string(),
                    symbol: abbreviate_fund_name(&clean_name),
                    description: clean_name,
                    quantity: shares_end,
                    price: price_end,
                    ending_value_cents: (value_end * 100.0).round() as i64,
                    cost_basis_cents: None,
                });
            }
        } else {
            // Text-only line — this is (part of) a fund name or a category
            // Accumulate it
            if let Some(ref mut pending) = pending_name {
                *pending = format!("{} {}", pending, line);
            } else {
                pending_name = Some(line.to_string());
            }
        }
    }

    Ok(holdings)
}

/// Parse a Schwab brokerage PDF statement.
/// pdf-extract produces single-line rows like:
///   "ACHR ARCHER AVIATION INC 47.0000 7.12000 334.64 463.82 (129.18) N/A N/A <1%"
/// Format: SYMBOL DESCRIPTION... QUANTITY PRICE MARKET_VALUE COST_BASIS GAIN_LOSS YIELD ANNUAL_INCOME PCT
fn parse_schwab_pdf(text: &str) -> Result<Vec<ImportedHolding>, String> {
    let lines: Vec<&str> = text.lines().collect();
    let mut holdings = Vec::new();

    // Get account info
    let mut account_name = "Schwab Brokerage".to_string();
    let mut account_number = String::new();
    for line in &lines {
        let l = line.trim();
        if l.contains("Account Nickname") {
            // "Schwab One® Account of Account Nickname"
            // Next line has the nickname
            continue;
        }
        if l == "YieldMax" || (!l.is_empty() && !l.contains("Account") && !l.contains("Schwab") && account_name == "Schwab Brokerage") {
            // Heuristic: skip
        }
        if l.starts_with("9") && l.contains("-") && l.len() < 15 && account_number.is_empty() {
            account_number = l.to_string();
        }
    }
    // Better: look for the nickname pattern
    for (idx, line) in lines.iter().enumerate() {
        if line.contains("Account Nickname") {
            // Next non-empty line is the nickname
            for j in (idx+1)..lines.len() {
                let next = lines[j].trim();
                if !next.is_empty() && !next.contains("PATRICK") && !next.contains("Account") {
                    account_name = next.split("PATRICK").next().unwrap_or(next).trim().to_string();
                    break;
                }
            }
            break;
        }
    }

    // Find "Positions - Equities" and "Positions - Exchange Traded Funds" sections
    for line in &lines {
        let l = line.trim();

        // Skip non-holding lines
        if !l.starts_with("Positions - ") {
            // Check if this is a holding line in a positions section
            // A holding line has: SYMBOL(all caps, 1-5 chars) followed by description then numbers
            // But we need to be in a positions section first
        }
    }

    // Strategy: find lines that match the holding pattern
    // A Schwab holding line looks like:
    //   "ACHR ARCHER AVIATION INC 47.0000 7.12000 334.64 463.82 (129.18) N/A N/A <1%"
    // Key: starts with a short uppercase symbol, ends with a percentage, has numbers in the middle

    let mut in_equities = false;
    let mut in_etfs = false;

    for line in &lines {
        let l = line.trim();

        if l.starts_with("Positions - Equities") {
            in_equities = true;
            in_etfs = false;
            continue;
        }
        if l.starts_with("Positions - Exchange Traded Funds") {
            in_etfs = true;
            in_equities = false;
            continue;
        }
        if l.starts_with("Positions - Options") || l.starts_with("Positions - Summary") {
            in_equities = false;
            in_etfs = false;
            continue;
        }
        if l.starts_with("Total Equities") || l.starts_with("Total Exchange") {
            continue;
        }

        if !in_equities && !in_etfs {
            continue;
        }

        // Skip header/empty lines
        if l.is_empty() || l.starts_with("Symbol") || l.starts_with("Description")
            || l.starts_with("Quantity") || l.starts_with("Price") || l.starts_with("Market")
            || l.starts_with("Cost") || l.starts_with("Unrealized") || l.starts_with("Gain")
            || l.starts_with("Est.") || l.starts_with("Yield") || l.starts_with("Income")
            || l.starts_with("% of") || l.starts_with("Acct") || l.contains("of 8")
            || l.starts_with("Statement Period") || l.starts_with("Schwab")
            || l.starts_with("February") || l.starts_with("PATRICK")
        {
            continue;
        }

        // Try to parse as a holding line
        // Split into tokens and find where numbers start
        let tokens: Vec<&str> = l.split_whitespace().collect();
        if tokens.len() < 5 {
            continue;
        }

        // First token should be a symbol (uppercase letters/digits)
        let symbol = tokens[0];
        if !symbol.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) {
            continue;
        }

        // Find where numbers start by scanning from the end
        // The last token is PCT (like "<1%" or "6%")
        // Before that: annual_income (or N/A), yield (or N/A), gain_loss, cost_basis, market_value, price, quantity
        // So from the end: pct, annual_income, yield, gain_loss, cost_basis, market_value, price, quantity = 8 values
        // Description is everything between symbol and quantity

        // Find the first numeric token after the symbol
        let mut num_start = 0;
        for (j, token) in tokens.iter().enumerate().skip(1) {
            let cleaned = token.replace(",", "").replace("(", "").replace(")", "");
            if cleaned.parse::<f64>().is_ok() && cleaned.len() > 1 {
                num_start = j;
                break;
            }
        }

        if num_start < 2 {
            continue; // Need at least symbol + 1 word of description
        }

        let description = tokens[1..num_start].join(" ");
        let num_tokens: Vec<&str> = tokens[num_start..].to_vec();

        // Need at least: quantity, price, market_value
        if num_tokens.len() < 3 {
            continue;
        }

        let quantity = match parse_schwab_number(num_tokens[0]) {
            Some(q) => q.abs(),
            None => continue,
        };
        let price = match parse_schwab_number(num_tokens[1]) {
            Some(p) => p,
            None => continue,
        };
        let market_value = match parse_schwab_number(num_tokens[2]) {
            Some(v) => v,
            None => quantity * price,
        };
        let cost_basis = if num_tokens.len() > 3 {
            parse_schwab_number(num_tokens[3])
        } else {
            None
        };

        if quantity > 0.0 {
            holdings.push(ImportedHolding {
                account_name: format!("{} ({})", account_name, account_number),
                account_number: account_number.clone(),
                account_type: "taxable".to_string(),
                symbol: symbol.to_string(),
                description,
                quantity,
                price,
                ending_value_cents: (market_value * 100.0).round() as i64,
                cost_basis_cents: cost_basis.map(|v| (v * 100.0).round() as i64),
            });
        }
    }

    // Grab cash balance from "Total Cash and Cash Investments" line
    for line in &lines {
        let l = line.trim();
        if l.starts_with("Total Cash and Cash Investments") {
            // Line looks like: "Total Cash and Cash Investments $44,190.93 $40,241.92 ($3,949.01) 68%"
            let tokens: Vec<&str> = l.split_whitespace().collect();
            // Find dollar amounts — the second one is ending balance
            let dollar_vals: Vec<f64> = tokens.iter()
                .filter_map(|t| parse_dollar_token(t))
                .collect();
            if dollar_vals.len() >= 2 {
                let ending = dollar_vals[1]; // second dollar amount is ending balance
                holdings.push(ImportedHolding {
                    account_name: format!("{} ({})", account_name, account_number),
                    account_number: account_number.clone(),
                    account_type: "taxable".to_string(),
                    symbol: "CASH".to_string(),
                    description: "Cash and Cash Investments".to_string(),
                    quantity: ending,
                    price: 1.0,
                    ending_value_cents: (ending * 100.0).round() as i64,
                    cost_basis_cents: None,
                });
            }
            break;
        }
    }

    Ok(holdings)
}

/// Parse a Schwab number which may have parens for negatives: "(129.18)" -> -129.18
fn parse_schwab_number(s: &str) -> Option<f64> {
    let trimmed = s.trim();
    if trimmed == "N/A" || trimmed.ends_with('%') || trimmed.starts_with('<') {
        return None;
    }
    let is_negative = trimmed.starts_with('(') && trimmed.ends_with(')');
    let cleaned = trimmed.replace(",", "").replace("$", "").replace("(", "").replace(")", "");
    cleaned.parse::<f64>().ok().map(|v| if is_negative { -v } else { v })
}

/// Create a short symbol from a fund name like "FID 500 Index" -> "FID500"
fn abbreviate_fund_name(name: &str) -> String {
    let tokens: Vec<&str> = name.split_whitespace().collect();
    if tokens.len() <= 2 {
        return tokens.join("").to_uppercase();
    }
    // Take first letters/words up to ~6 chars
    let mut abbrev = String::new();
    for token in &tokens {
        if abbrev.len() >= 6 {
            break;
        }
        if token.len() <= 3 {
            abbrev.push_str(&token.to_uppercase());
        } else {
            abbrev.push_str(&token[..3].to_uppercase());
        }
    }
    abbrev
}

/// Fix broken numbers from pdf-extract where a number gets split by a space.
/// e.g., "$142,1 16.48" should be "$142,116.48"
/// Pattern: a token ending with comma+digits, followed by a token that's just digits+optional decimal
fn fix_broken_pdf_numbers(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    for line in text.lines() {
        let tokens: Vec<&str> = line.split(' ').collect();
        let mut fixed_tokens: Vec<String> = Vec::new();
        let mut i = 0;
        while i < tokens.len() {
            let token = tokens[i];
            // Check if this token looks like a broken number: ends with comma+1-2 digits
            // and next token is digits (possibly with decimal)
            if i + 1 < tokens.len() {
                let trimmed = token.trim();
                let next = tokens[i + 1].trim();
                // Pattern: "142,1" or "$142,1" followed by "16.48" or "116.48"
                let is_broken = trimmed.len() > 2
                    && trimmed.contains(',')
                    && trimmed.chars().last().map_or(false, |c| c.is_ascii_digit())
                    && {
                        // Check the part after the last comma is only 1-2 digits (incomplete)
                        let after_comma = trimmed.rsplit(',').next().unwrap_or("");
                        after_comma.len() <= 2 && after_comma.chars().all(|c| c.is_ascii_digit())
                    }
                    && !next.is_empty()
                    && next.chars().all(|c| c.is_ascii_digit() || c == '.');
                if is_broken {
                    // Join them
                    fixed_tokens.push(format!("{}{}", trimmed, next));
                    i += 2;
                    continue;
                }
            }
            fixed_tokens.push(token.to_string());
            i += 1;
        }
        result.push_str(&fixed_tokens.join(" "));
        result.push('\n');
    }
    result
}

/// Auto-detect file type and parse accordingly
fn parse_investment_file(file_path: &str) -> Result<Vec<ImportedHolding>, String> {
    let lower = file_path.to_lowercase();
    if lower.ends_with(".pdf") {
        let bytes = std::fs::read(file_path)
            .map_err(|e| format!("Failed to read PDF: {}", e))?;
        let text = pdf_extract::extract_text_from_mem(&bytes)
            .map_err(|e| format!("Failed to extract text from PDF: {}", e))?;

        // Fix broken numbers from pdf-extract: "$142,1 16.48" -> "$142,116.48"
        // Pattern: dollar amount with comma followed by 1 digit, space, then more digits
        let text = fix_broken_pdf_numbers(&text);

        // Auto-detect PDF format
        if text.contains("NetBenefits") || text.contains("401(k)") || text.contains("Market Value of Your Account") {
            parse_netbenefits_pdf(&text)
        } else if text.contains("Schwab") || text.contains("schwab.com") {
            parse_schwab_pdf(&text)
        } else {
            parse_vanguard_pdf(&text)
        }
    } else {
        let content = std::fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        parse_fidelity_statement(&content)
    }
}

#[tauri::command]
pub fn preview_investment_csv(file_path: String) -> Result<Vec<ImportedHolding>, String> {
    parse_investment_file(&file_path)
}

#[tauri::command]
pub fn import_investment_csv(
    state: State<'_, DbState>,
    file_path: String,
) -> Result<InvestmentImportResult, String> {
    let holdings = parse_investment_file(&file_path)?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut created = 0usize;
    let mut updated = 0usize;
    let mut skipped = 0usize;

    for holding in &holdings {
        // Check if asset already exists by ticker + account_number combo
        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM assets WHERE ticker = ?1 AND institution = ?2",
                rusqlite::params![holding.symbol, holding.account_number],
                |row| row.get(0),
            )
            .ok();

        if let Some(id) = existing_id {
            // Update existing asset
            conn.execute(
                "UPDATE assets SET current_value_cents = ?1, shares = ?2, cost_basis_cents = ?3, updated_at = ?4
                 WHERE id = ?5",
                rusqlite::params![
                    holding.ending_value_cents,
                    holding.quantity,
                    holding.cost_basis_cents,
                    now,
                    id,
                ],
            )
            .map_err(|e| e.to_string())?;
            updated += 1;
        } else {
            // Create new asset
            let id = Uuid::new_v4().to_string();
            let asset_type = if holding.symbol == "SPAXX"
                || holding.symbol == "QUSCQ"
                || holding.description.to_lowercase().contains("money market")
                || holding.description.to_lowercase().contains("fdic")
            {
                "Cash"
            } else {
                "Investment"
            };

            conn.execute(
                "INSERT INTO assets (id, name, asset_type, institution, current_value_cents, ticker, shares, cost_basis_cents, tax_treatment, is_manual, notes, updated_at, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10, ?11, ?11)",
                rusqlite::params![
                    id,
                    format!("{} ({})", holding.description.trim(), holding.symbol),
                    asset_type,
                    holding.account_number,
                    holding.ending_value_cents,
                    holding.symbol,
                    holding.quantity,
                    holding.cost_basis_cents,
                    holding.account_type,
                    format!("Imported from Fidelity - {}", holding.account_name),
                    now,
                ],
            )
            .map_err(|e| e.to_string())?;
            created += 1;
        }
    }

    Ok(InvestmentImportResult {
        holdings: holdings.clone(),
        created,
        updated,
        skipped,
    })
}
