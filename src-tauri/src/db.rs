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

    // Set SQLCipher encryption key
    let app_data_dir = db_path.parent().ok_or("Invalid db path")?;
    let db_key = get_or_create_db_key(app_data_dir)?;
    conn.pragma_update(None, "key", &db_key)
        .map_err(|e| format!("Failed to set encryption key: {}", e))?;

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
