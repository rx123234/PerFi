use rusqlite::Connection;

pub type CategoryRuleRow = (String, String);

/// Load all categorization rules from the database, sorted by priority.
pub fn load_rules(conn: &Connection) -> Vec<CategoryRuleRow> {
    let mut stmt = match conn.prepare(
        "SELECT pattern, category_id FROM category_rules ORDER BY priority DESC, pattern",
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Warning: failed to load category rules: {}", e);
            return Vec::new();
        }
    };

    let mapped = match stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?))) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Warning: failed to query category rules: {}", e);
            return Vec::new();
        }
    };

    mapped
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("Warning: failed to parse rule row: {}", e);
                None
            }
        })
        .collect()
}

/// Match a transaction against pre-loaded rules. Returns the first matching category_id.
pub fn categorize_with_rules(
    rules: &[CategoryRuleRow],
    description: &str,
    merchant: &Option<String>,
) -> Option<String> {
    let desc_upper = description.to_uppercase();
    let merchant_upper = merchant.as_deref().unwrap_or("").to_uppercase();

    for (pattern, category_id) in rules {
        let pattern_upper = pattern.to_uppercase();
        if desc_upper.contains(&pattern_upper) || merchant_upper.contains(&pattern_upper) {
            return Some(category_id.clone());
        }
    }

    None
}

/// Convenience: load rules from DB and categorize a single transaction.
pub fn categorize_transaction(
    conn: &Connection,
    description: &str,
    merchant: &Option<String>,
) -> Option<String> {
    let rules = load_rules(conn);
    categorize_with_rules(&rules, description, merchant)
}

/// Recategorize all uncategorized transactions using pre-loaded rules (O(1) DB query for rules).
pub fn recategorize_all(conn: &Connection) -> Result<usize, String> {
    let rules = load_rules(conn);
    if rules.is_empty() {
        return Ok(0);
    }

    let tx_ids: Vec<(String, String, Option<String>)> = {
        let mut stmt = conn
            .prepare("SELECT id, description, merchant FROM transactions WHERE category_id IS NULL")
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| e.to_string())?;
        mapped
            .filter_map(|r| match r {
                Ok(v) => Some(v),
                Err(e) => {
                    eprintln!("Warning: failed to parse transaction row: {}", e);
                    None
                }
            })
            .collect()
    };

    let mut count = 0;
    for (id, description, merchant) in &tx_ids {
        if let Some(category_id) = categorize_with_rules(&rules, description, merchant) {
            conn.execute(
                "UPDATE transactions SET category_id = ?1 WHERE id = ?2",
                rusqlite::params![category_id, id],
            )
            .map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    Ok(count)
}
