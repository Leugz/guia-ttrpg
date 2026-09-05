#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Application shell.
//!
//! Bootstrapping only: logging, the SQLite session store, shared state and the
//! IPC surface. The LAN server is no longer started here; it comes up when a GM
//! opens a table (see `network::server`) and shuts down when they leave.

mod api;
mod campaign;
mod commands;
mod dice;
mod effects;
mod history;
mod models;
mod network;
mod rules;
mod state;
mod storage;

use std::sync::Arc;

use tauri::Manager;

use crate::state::AppState;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .setup(|app| {
            init_logging(app.handle());

            let data_dir = app
                .path()
                .app_local_data_dir()
                .expect("Failed to resolve the application data directory");
            std::fs::create_dir_all(&data_dir)
                .expect("Failed to create the application data directory");

            let db_path = data_dir.join("session.db");
            if let Err(error) = history::init(&db_path) {
                tracing::error!(%error, "failed to initialise the session database");
            }

            state::install(Arc::new(AppState::new(db_path)));
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
            // Resources
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
            commands::revoke_sheet_access,
            // Game lifecycle
            commands::create_game_instance,
            commands::delete_game_instance,
            commands::list_game_sheets,
            commands::list_game_handouts,
            commands::start_hosting,
            commands::stop_hosting,
            commands::host_address,
            commands::toggle_handout_public,
            commands::toggle_handout_share,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
