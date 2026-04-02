use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvFormat {
    pub name: String,
    pub date_column: String,
    pub date_format: String,
    pub description_column: String,
    pub amount_column: Option<String>,
    pub debit_column: Option<String>,
    pub credit_column: Option<String>,
    pub amount_inverted: bool,
}

#[derive(Debug, Clone)]
pub struct ParsedTransaction {
    pub date: String,
    pub amount_cents: i64,
    pub description: String,
    pub import_hash: String,
}

pub fn get_csv_formats() -> Vec<CsvFormat> {
    vec![
        CsvFormat {
            name: "Chase Credit Card".to_string(),
            date_column: "Transaction Date".to_string(),
            date_format: "%m/%d/%Y".to_string(),
            description_column: "Description".to_string(),
            amount_column: Some("Amount".to_string()),
            debit_column: None,
            credit_column: None,
            amount_inverted: true,

        },
        CsvFormat {
            name: "Chase Checking".to_string(),
            date_column: "Posting Date".to_string(),
            date_format: "%m/%d/%Y".to_string(),
            description_column: "Description".to_string(),
            amount_column: Some("Amount".to_string()),
            debit_column: None,
            credit_column: None,
            amount_inverted: false,

        },
        CsvFormat {
            name: "Capital One Credit Card".to_string(),
            date_column: "Transaction Date".to_string(),
            date_format: "%Y-%m-%d".to_string(),
            description_column: "Description".to_string(),
            amount_column: None,
            debit_column: Some("Debit".to_string()),
            credit_column: Some("Credit".to_string()),
            amount_inverted: false,

        },
        CsvFormat {
            name: "Capital One Checking".to_string(),
            date_column: "Transaction Date".to_string(),
            date_format: "%Y-%m-%d".to_string(),
            description_column: "Transaction Description".to_string(),
            amount_column: None,
            debit_column: Some("Debit".to_string()),
            credit_column: Some("Credit".to_string()),
            amount_inverted: false,

        },
        CsvFormat {
            name: "Bank of America".to_string(),
            date_column: "Date".to_string(),
            date_format: "%m/%d/%Y".to_string(),
            description_column: "Description".to_string(),
            amount_column: Some("Amount".to_string()),
            debit_column: None,
            credit_column: None,
            amount_inverted: false,

        },
        CsvFormat {
            name: "American Express".to_string(),
            date_column: "Date".to_string(),
            date_format: "%m/%d/%Y".to_string(),
            description_column: "Description".to_string(),
            amount_column: Some("Amount".to_string()),
            debit_column: None,
            credit_column: None,
            amount_inverted: true,

        },
        CsvFormat {
            name: "Citi Credit Card".to_string(),
            date_column: "Date".to_string(),
            date_format: "%m/%d/%Y".to_string(),
            description_column: "Description".to_string(),
            amount_column: None,
            debit_column: Some("Debit".to_string()),
            credit_column: Some("Credit".to_string()),
            amount_inverted: false,

        },
        CsvFormat {
            name: "Ally Bank".to_string(),
            date_column: "Date".to_string(),
            date_format: "%Y-%m-%d".to_string(),
            description_column: "Description".to_string(),
            amount_column: Some("Amount".to_string()),
            debit_column: None,
            credit_column: None,
            amount_inverted: false,
        },
        CsvFormat {
            name: "Wells Fargo".to_string(),
            date_column: "Date".to_string(),
            date_format: "%m/%d/%Y".to_string(),
            description_column: "Description".to_string(),
            amount_column: Some("Amount".to_string()),
            debit_column: None,
            credit_column: None,
            amount_inverted: false,

        },
    ]
}

pub struct ParseResult {
    pub transactions: Vec<ParsedTransaction>,
    pub warnings: Vec<String>,
}

pub fn parse_csv(
    file_path: &str,
    format: &CsvFormat,
    account_id: &str,
) -> Result<ParseResult, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_path(file_path)
        .map_err(|e| format!("Failed to read CSV: {}", e))?;

    let headers = reader
        .headers()
        .map_err(|e| format!("Failed to read headers: {}", e))?
        .clone();

    let header_map: HashMap<String, usize> = headers
        .iter()
        .enumerate()
        .map(|(i, h)| (h.trim().to_string(), i))
        .collect();

    let date_idx = *header_map
        .get(&format.date_column)
        .ok_or_else(|| format!("Date column '{}' not found in CSV", format.date_column))?;
    let desc_idx = *header_map
        .get(&format.description_column)
        .ok_or_else(|| {
            format!(
                "Description column '{}' not found in CSV",
                format.description_column
            )
        })?;

    let amount_idx = format
        .amount_column
        .as_ref()
        .and_then(|col| header_map.get(col))
        .copied();
    let debit_idx = format
        .debit_column
        .as_ref()
        .and_then(|col| header_map.get(col))
        .copied();
    let credit_idx = format
        .credit_column
        .as_ref()
        .and_then(|col| header_map.get(col))
        .copied();

    let mut transactions = Vec::new();
    let mut warnings = Vec::new();

    for (row_num, result) in reader.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                warnings.push(format!("Row {}: failed to read: {}", row_num + 1, e));
                continue;
            }
        };

        let date_str = record.get(date_idx).unwrap_or("").trim();
        if date_str.is_empty() {
            continue;
        }

        let parsed_date = match chrono::NaiveDate::parse_from_str(date_str, &format.date_format) {
            Ok(d) => d,
            Err(e) => {
                warnings.push(format!("Row {}: date parse error: {} (value: '{}')", row_num + 1, e, date_str));
                continue;
            }
        };
        let date = parsed_date.format("%Y-%m-%d").to_string();

        let description = record.get(desc_idx).unwrap_or("").trim().to_string();
        if description.is_empty() {
            continue;
        }

        // Parse amount as f64 then convert to integer cents for precision
        let amount_dollars = if let Some(idx) = amount_idx {
            let val_str = record.get(idx).unwrap_or("").trim().replace(['$', ','], "");
            if val_str.is_empty() {
                continue;
            }
            let val: f64 = match val_str.parse() {
                Ok(v) => v,
                Err(e) => {
                    warnings.push(format!("Row {}: amount parse error: {} (value: '{}')", row_num + 1, e, val_str));
                    continue;
                }
            };
            if format.amount_inverted { -val } else { val }
        } else {
            let debit_str = debit_idx
                .and_then(|idx| record.get(idx))
                .unwrap_or("")
                .trim()
                .replace(['$', ','], "");
            let credit_str = credit_idx
                .and_then(|idx| record.get(idx))
                .unwrap_or("")
                .trim()
                .replace(['$', ','], "");

            let debit: f64 = if debit_str.is_empty() {
                0.0
            } else {
                match debit_str.parse() {
                    Ok(v) => v,
                    Err(e) => {
                        warnings.push(format!("Row {}: debit parse error: {} (value: '{}')", row_num + 1, e, debit_str));
                        continue;
                    }
                }
            };
            let credit: f64 = if credit_str.is_empty() {
                0.0
            } else {
                match credit_str.parse() {
                    Ok(v) => v,
                    Err(e) => {
                        warnings.push(format!("Row {}: credit parse error: {} (value: '{}')", row_num + 1, e, credit_str));
                        continue;
                    }
                }
            };

            credit - debit
        };

        let amount_cents = (amount_dollars * 100.0).round() as i64;

        // Include row_num so legitimate same-day duplicates (e.g. two $50 Starbucks) get unique hashes.
        let mut hasher = Sha256::new();
        hasher.update(format!("{}|{}|{}|{}|{}", account_id, date, amount_cents, description, row_num));
        let hash = format!("{:x}", hasher.finalize());

        transactions.push(ParsedTransaction {
            date,
            amount_cents,
            description,
            import_hash: hash,
        });
    }

    Ok(ParseResult { transactions, warnings })
}
