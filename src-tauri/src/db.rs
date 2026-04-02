use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

const KEYRING_SERVICE: &str = "com.perfi.app";
const KEYRING_DB_KEY: &str = "db-encryption-key";

pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_dir.join("perfi.db"))
}

/// Get or create the database encryption key from the OS keychain.
/// Falls back to a file-based key if the keychain is unavailable (e.g., headless environments).
fn get_or_create_db_key(app_data_dir: &std::path::Path) -> Result<String, String> {
    // Try OS keychain first
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_DB_KEY)
        .map_err(|e| format!("Keyring init error: {}", e))?;

    match entry.get_password() {
        Ok(key) => return Ok(key),
        Err(keyring::Error::NoEntry) => {
            // No key yet — generate and store one
            let key = generate_random_key();
            match entry.set_password(&key) {
                Ok(()) => return Ok(key),
                Err(e) => {
                    eprintln!("Keychain unavailable ({}), falling back to file-based key", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Keychain read error ({}), falling back to file-based key", e);
        }
    }

    // Fallback: file-based key in app data dir (still better than no encryption)
    let key_path = app_data_dir.join(".perfi_key");
    if key_path.exists() {
        fs::read_to_string(&key_path)
            .map(|k| k.trim().to_string())
            .map_err(|e| format!("Failed to read key file: {}", e))
    } else {
        let key = generate_random_key();
        fs::write(&key_path, &key)
            .map_err(|e| format!("Failed to write key file: {}", e))?;
        // Restrict permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&key_path, fs::Permissions::from_mode(0o600))
                .map_err(|e| format!("Failed to set key file permissions: {}", e))?;
        }
        Ok(key)
    }
}

fn generate_random_key() -> String {
    let mut key_bytes = [0u8; 32];
    // Use the same CSPRNG that backs uuid::Uuid::new_v4 (getrandom)
    getrandom::getrandom(&mut key_bytes).expect("OS CSPRNG unavailable");
    key_bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn initialize(db_path: &PathBuf) -> Result<Connection, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database at {:?}: {}", db_path, e))?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set database pragmas: {}", e))?;

    run_migrations(&conn)?;

    Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )
    .map_err(|e| format!("Failed to create migrations table: {}", e))?;

    let applied: Vec<i32> = conn
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .map_err(|e| format!("Failed to query migrations: {}", e))?
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to read migrations: {}", e))?
        .filter_map(|r| match r {
            Ok(v) => Some(v),
            Err(e) => { eprintln!("Warning: failed to read migration row: {}", e); None }
        })
        .collect();

    if !applied.contains(&1) {
        let migration = include_str!("../migrations/001_initial.sql");
        conn.execute_batch(migration)
            .map_err(|e| format!("Failed to run migration 001: {}", e))?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [1],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;
        eprintln!("Applied migration 001_initial.sql");
    }

    if !applied.contains(&2) {
        let migration = include_str!("../migrations/002_teller.sql");
        conn.execute_batch(migration)
            .map_err(|e| format!("Failed to run migration 002: {}", e))?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [2],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;
        eprintln!("Applied migration 002_teller.sql");
    }

    if !applied.contains(&3) {
        let migration = include_str!("../migrations/003_fix_categories.sql");
        conn.execute_batch(migration)
            .map_err(|e| format!("Failed to run migration 003: {}", e))?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [3],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;
        eprintln!("Applied migration 003_fix_categories.sql");
    }

    if !applied.contains(&4) {
        let migration = include_str!("../migrations/004_wealth_planning.sql");
        conn.execute_batch(migration)
            .map_err(|e| format!("Failed to run migration 004: {}", e))?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [4],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;
        eprintln!("Applied migration 004_wealth_planning.sql");
    }

    if !applied.contains(&5) {
        let migration = include_str!("../migrations/005_account_balances.sql");
        conn.execute_batch(migration)
            .map_err(|e| format!("Failed to run migration 005: {}", e))?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [5],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;
        eprintln!("Applied migration 005_account_balances.sql");
    }

    if !applied.contains(&6) {
        let migration = include_str!("../migrations/006_planning_exclusions.sql");
        conn.execute_batch(migration)
            .map_err(|e| format!("Failed to run migration 006: {}", e))?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [6],
        )
        .map_err(|e| format!("Failed to record migration: {}", e))?;
        eprintln!("Applied migration 006_planning_exclusions.sql");
    }

    Ok(())
}

/// Store a secret in the OS keychain, with file fallback
pub fn store_secret(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key)
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry.set_password(value)
        .map_err(|e| format!("Failed to store secret: {}", e))
}

/// Retrieve a secret from the OS keychain
pub fn get_secret(key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key)
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve secret: {}", e)),
    }
}

/// Delete a secret from the OS keychain
#[allow(dead_code)]
pub fn delete_secret(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key)
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone
        Err(e) => Err(format!("Failed to delete secret: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::run_migrations;
    use rusqlite::Connection;

    #[test]
    fn planning_exclusion_migration_adds_columns_with_default_zero() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )
        .expect("create schema_migrations");

        conn.execute_batch(include_str!("../migrations/001_initial.sql"))
            .expect("apply 001");
        conn.execute("INSERT INTO schema_migrations (version) VALUES (1)", [])
            .expect("record 001");
        conn.execute_batch(include_str!("../migrations/002_teller.sql"))
            .expect("apply 002");
        conn.execute("INSERT INTO schema_migrations (version) VALUES (2)", [])
            .expect("record 002");
        conn.execute_batch(include_str!("../migrations/003_fix_categories.sql"))
            .expect("apply 003");
        conn.execute("INSERT INTO schema_migrations (version) VALUES (3)", [])
            .expect("record 003");
        conn.execute_batch(include_str!("../migrations/004_wealth_planning.sql"))
            .expect("apply 004");
        conn.execute("INSERT INTO schema_migrations (version) VALUES (4)", [])
            .expect("record 004");
        conn.execute_batch(include_str!("../migrations/005_account_balances.sql"))
            .expect("apply 005");
        conn.execute("INSERT INTO schema_migrations (version) VALUES (5)", [])
            .expect("record 005");

        run_migrations(&conn).expect("apply planning exclusion migration");

        let tx_column_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('transactions') WHERE name = 'exclude_from_planning'",
                [],
                |row| row.get(0),
            )
            .expect("transactions column count");
        let category_column_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('categories') WHERE name = 'exclude_from_planning'",
                [],
                |row| row.get(0),
            )
            .expect("categories column count");

        assert_eq!(tx_column_count, 1);
        assert_eq!(category_column_count, 1);

        conn.execute(
            "INSERT INTO accounts (id, name, account_type, source) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params!["acc-1", "Checking", "checking", "manual"],
        )
        .expect("insert account");
        conn.execute(
            "INSERT INTO categories (id, name) VALUES (?1, ?2)",
            rusqlite::params!["cat-1", "Planning Test Category"],
        )
        .expect("insert category");
        conn.execute(
            "INSERT INTO transactions (id, account_id, date, amount_cents, description, category_id, source)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                "tx-1",
                "acc-1",
                "2026-03-01",
                "-120000",
                "Rent",
                "cat-1",
                "manual",
            ],
        )
        .expect("insert transaction");

        let category_default: i64 = conn
            .query_row(
                "SELECT exclude_from_planning FROM categories WHERE id = 'cat-1'",
                [],
                |row| row.get(0),
            )
            .expect("category default");
        let transaction_default: i64 = conn
            .query_row(
                "SELECT exclude_from_planning FROM transactions WHERE id = 'tx-1'",
                [],
                |row| row.get(0),
            )
            .expect("transaction default");

        assert_eq!(category_default, 0);
        assert_eq!(transaction_default, 0);
    }
}
