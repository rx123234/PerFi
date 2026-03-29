use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
    app_dir.join("perfi.db")
}

pub fn initialize(db_path: &PathBuf) -> Connection {
    let conn = Connection::open(db_path).expect("Failed to open database");

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .expect("Failed to set pragmas");

    run_migrations(&conn);

    conn
}

fn run_migrations(conn: &Connection) {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )
    .expect("Failed to create migrations table");

    let applied: Vec<i32> = conn
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    if !applied.contains(&1) {
        let migration = include_str!("../migrations/001_initial.sql");
        conn.execute_batch(migration)
            .expect("Failed to run migration 001");
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [1],
        )
        .expect("Failed to record migration");
        println!("Applied migration 001_initial.sql");
    }
}
