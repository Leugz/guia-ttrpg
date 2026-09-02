// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod dice;
mod effects;
mod models;
mod rules;
mod storage;

use axum::{routing::get, Router};
use std::net::SocketAddr;
use tauri::Manager;

/// LAN server port advertised on the hosting screen (§4.1).
const LAN_PORT: u16 = 3000;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Logging is configured first so the LAN server's own startup lines
            // land in app.log (§14).
            init_logging(app.handle());
            tokio::spawn(serve_lan());
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Documents
            commands::load_character_sheet,
            commands::save_character_sheet,
            commands::create_character_sheet,
            // Dice
            commands::execute_roll,
            commands::roll_dice,
            commands::preview_test,
            commands::roll_test,
            // Resources and saving throws
            commands::modify_resource,
            commands::apply_resource_change,
            commands::roll_death_save,
            // Sheet editing
            commands::set_attribute,
            commands::step_attribute,
            commands::set_skill_value,
            commands::step_skill,
            commands::toggle_entry,
            // Effects
            commands::list_builtin_effects,
            commands::list_default_skills,
            commands::apply_builtin_effect,
            commands::remove_active_effect,
            commands::describe_entry,
            // Multi-sheet access
            commands::grant_sheet_access,
            commands::revoke_sheet_access
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Binds the Axum LAN server. A busy port is logged rather than allowed to take
/// the desktop application down with it.
async fn serve_lan() {
    let router = Router::new().route("/ws", get(ws_handler));
    let addr = SocketAddr::from(([0, 0, 0, 0], LAN_PORT));
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

/// Sets up the rolling `app.log` in the platform log directory (§14).
///
/// The worker guard is leaked on purpose: it has to outlive the application for
/// buffered lines to keep reaching disk.
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

/// Placeholder for the LAN WebSocket endpoint. Real-time synchronization is
/// tracked separately from the RPG rules engine.
async fn ws_handler() {}
