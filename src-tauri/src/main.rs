#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod dice;
mod effects;
mod models;
mod rules;
mod storage;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    routing::get,
    Router,
};
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::broadcast;

const LAN_PORT: u16 = 37373;

struct AppState {
    tx: broadcast::Sender<String>,
    db_path: PathBuf,
}

#[tokio::main]
async fn main() {
    let (tx, _rx) = broadcast::channel(100);
    let tx_clone = tx.clone();

    tauri::Builder::default()
        .setup(move |app| {
            init_logging(app.handle());

            // Resolve the system's standard application data directory
            let data_dir = app
                .path()
                .app_local_data_dir()
                .expect("Failed to get data dir");
            std::fs::create_dir_all(&data_dir).expect("Failed to create data dir");
            let db_path = data_dir.join("session.db");

            init_sqlite(&db_path).expect("Failed to initialize SQLite database");

            let app_state = Arc::new(AppState {
                tx: tx_clone,
                db_path,
            });

            tokio::spawn(serve_lan(app_state));

            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_character_sheet,
            commands::save_character_sheet,
            commands::create_character_sheet,
            commands::execute_roll,
            commands::roll_dice,
            commands::preview_test,
            commands::roll_test,
            commands::modify_resource,
            commands::apply_resource_change,
            commands::roll_death_save,
            commands::set_attribute,
            commands::step_attribute,
            commands::set_skill_value,
            commands::step_skill,
            commands::toggle_entry,
            commands::list_builtin_effects,
            commands::list_default_skills,
            commands::apply_builtin_effect,
            commands::remove_active_effect,
            commands::describe_entry,
            commands::grant_sheet_access,
            commands::revoke_sheet_access,
            commands::create_game_instance // Cleanly namespaced!
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn init_sqlite(db_path: &Path) -> rusqlite::Result<()> {
    let conn = Connection::open(db_path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    Ok(())
}

async fn serve_lan(state: Arc<AppState>) {
    let router = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(state);

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], LAN_PORT));

    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            tracing::info!(%addr, "LAN server listening");
            if let Err(error) = axum::serve(listener, router).await {
                tracing::error!(%error, "LAN server stopped");
            }
        }
        Err(error) => tracing::error!(%error, %addr, "failed to bind LAN server"),
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> axum::response::Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.tx.subscribe();

    loop {
        tokio::select! {
            Some(Ok(msg)) = socket.recv() => {
                if let Message::Text(text) = msg {
                    // Open the DB using the safe path provided by Tauri
                    if let Ok(conn) = Connection::open(&state.db_path) {
                        let id = uuid::Uuid::new_v4().to_string();
                        let _ = conn.execute(
                            "INSERT INTO chat_history (id, payload) VALUES (?1, ?2)",
                            [&id, &text],
                        );
                    }
                    let _ = state.tx.send(text);
                }
            }
            Ok(msg) = rx.recv() => {
                if socket.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
        }
    }
}

fn init_logging(app: &tauri::AppHandle) {
    let Ok(log_dir) = app.path().app_log_dir() else {
        tracing_subscriber_fallback();
        return;
    };
    if std::fs::create_dir_all(&log_dir).is_err() {
        tracing_subscriber_fallback();
        return;
    }
    let appender = tracing_appender::rolling::daily(log_dir, "app.log");
    let (writer, guard) = tracing_appender::non_blocking(appender);
    std::mem::forget(guard);
    let subscriber = tracing_subscriber::fmt()
        .with_writer(writer)
        .with_ansi(false)
        .finish();
    let _ = tracing::subscriber::set_global_default(subscriber);
}

fn tracing_subscriber_fallback() {
    let _ = tracing::subscriber::set_global_default(tracing_subscriber::fmt().finish());
}
