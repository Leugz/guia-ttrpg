//! Runtime session data (chat and dice history) kept in SQLite.
//!
//! Markdown remains the source of truth for character state; this table only
//! holds the fast-moving event log that a reconnecting player needs in order to
//! catch up on what they missed.

use std::path::Path;

use rusqlite::Connection;
use serde_json::Value;

/// The pre-1.0 build wrote to an unscoped `chat_history` table. Rather than
/// migrate a schema nobody depends on yet, this uses a new table and leaves the
/// old one untouched.
pub fn init(db_path: &Path) -> rusqlite::Result<()> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS session_events (
            id         TEXT PRIMARY KEY,
            game_id    TEXT NOT NULL DEFAULT '',
            payload    TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        );
        CREATE INDEX IF NOT EXISTS idx_session_events_game
            ON session_events (game_id, created_at);",
    )?;
    Ok(())
}

/// Store one chat or roll payload. Duplicate ids are ignored so a client that
/// retries after a dropped connection cannot create a double entry.
pub fn record(db_path: &Path, game_id: &str, id: &str, payload: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open session db: {}", e))?;
    conn.execute(
        "INSERT OR IGNORE INTO session_events (id, game_id, payload) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, game_id, payload],
    )
    .map_err(|e| format!("Failed to record chat entry: {}", e))?;
    Ok(())
}

/// The most recent `limit` entries for a table, oldest first so the client can
/// append them in order.
pub fn recent(db_path: &Path, game_id: &str, limit: usize) -> Result<Vec<Value>, String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open session db: {}", e))?;
    let mut statement = conn
        .prepare(
            "SELECT payload FROM session_events
             WHERE game_id = ?1
             ORDER BY created_at DESC, rowid DESC
             LIMIT ?2",
        )
        .map_err(|e| format!("Failed to prepare history query: {}", e))?;

    let rows = statement
        .query_map(rusqlite::params![game_id, limit as i64], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| format!("Failed to read history: {}", e))?;

    let mut payloads = Vec::new();
    for row in rows {
        let raw = row.map_err(|e| format!("Failed to read history row: {}", e))?;
        match serde_json::from_str::<Value>(&raw) {
            Ok(value) => payloads.push(value),
            Err(error) => tracing::warn!(%error, "discarding unparsable history entry"),
        }
    }
    payloads.reverse();
    Ok(payloads)
}

/// Drop a table's log, used when its game instance is deleted.
pub fn clear(db_path: &Path, game_id: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open session db: {}", e))?;
    conn.execute(
        "DELETE FROM session_events WHERE game_id = ?1",
        rusqlite::params![game_id],
    )
    .map_err(|e| format!("Failed to clear history: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("guia-history-{tag}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("session.db")
    }

    #[test]
    fn entries_come_back_in_chronological_order() {
        let db = scratch("order");
        init(&db).unwrap();
        record(&db, "mesa", "1", r#"{"id":"1","content":"um"}"#).unwrap();
        record(&db, "mesa", "2", r#"{"id":"2","content":"dois"}"#).unwrap();
        record(&db, "mesa", "3", r#"{"id":"3","content":"tres"}"#).unwrap();

        let history = recent(&db, "mesa", 10).unwrap();
        let ids: Vec<&str> = history
            .iter()
            .map(|v| v.get("id").and_then(Value::as_str).unwrap())
            .collect();
        assert_eq!(ids, vec!["1", "2", "3"]);
    }

    #[test]
    fn history_is_scoped_per_table() {
        let db = scratch("scope");
        init(&db).unwrap();
        record(&db, "mesa_a", "1", r#"{"id":"1"}"#).unwrap();
        record(&db, "mesa_b", "2", r#"{"id":"2"}"#).unwrap();

        assert_eq!(recent(&db, "mesa_a", 10).unwrap().len(), 1);
        assert_eq!(recent(&db, "mesa_b", 10).unwrap().len(), 1);

        clear(&db, "mesa_a").unwrap();
        assert!(recent(&db, "mesa_a", 10).unwrap().is_empty());
        assert_eq!(recent(&db, "mesa_b", 10).unwrap().len(), 1);
    }

    #[test]
    fn replaying_the_same_id_does_not_duplicate_it() {
        let db = scratch("dedupe");
        init(&db).unwrap();
        record(&db, "mesa", "1", r#"{"id":"1"}"#).unwrap();
        record(&db, "mesa", "1", r#"{"id":"1"}"#).unwrap();
        assert_eq!(recent(&db, "mesa", 10).unwrap().len(), 1);
    }

    #[test]
    fn unparsable_rows_are_skipped_rather_than_failing_the_join() {
        let db = scratch("garbage");
        init(&db).unwrap();
        record(&db, "mesa", "1", "not json").unwrap();
        record(&db, "mesa", "2", r#"{"id":"2"}"#).unwrap();
        assert_eq!(recent(&db, "mesa", 10).unwrap().len(), 1);
    }
}
