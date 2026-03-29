use rusqlite::Connection;

pub fn categorize_transaction(conn: &Connection, description: &str, merchant: &Option<String>) -> Option<String> {
    let mut stmt = conn
        .prepare(
            "SELECT pattern, category_id FROM category_rules ORDER BY priority DESC, pattern",
        )
        .ok()?;

    let mapped = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .ok()?;
    let rules: Vec<(String, String)> = mapped.filter_map(|r| r.ok()).collect();

    let desc_upper = description.to_uppercase();
    let merchant_upper = merchant.as_deref().unwrap_or("").to_uppercase();

    for (pattern, category_id) in &rules {
        let pattern_upper = pattern.to_uppercase();
        if desc_upper.contains(&pattern_upper) || merchant_upper.contains(&pattern_upper) {
            return Some(category_id.clone());
        }
    }

    None
}

pub fn recategorize_all(conn: &Connection) -> Result<usize, String> {
    let tx_ids: Vec<(String, String, Option<String>)> = {
        let mut stmt = conn
            .prepare("SELECT id, description, merchant FROM transactions WHERE category_id IS NULL")
            .map_err(|e| e.to_string())?;
        let mapped = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| e.to_string())?;
        mapped.filter_map(|r| r.ok()).collect()
    };

    let mut count = 0;
    for (id, description, merchant) in &tx_ids {
        if let Some(category_id) = categorize_transaction(conn, description, merchant) {
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
