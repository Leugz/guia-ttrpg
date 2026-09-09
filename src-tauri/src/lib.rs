mod api;
mod campaign;
mod commands;
mod dice;
mod effects;
mod error;
mod history;
mod logging;
mod models;
mod network;
mod rules;
mod state;
mod storage;

use std::sync::Arc;
use tauri::Manager;

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                }
            }

            logging::init(app.handle());

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
            commands::create_game_instance,
            commands::delete_game_instance,
            commands::list_game_sheets,
            commands::list_game_handouts,
            commands::load_board,
            commands::save_board,
            commands::start_hosting,
            commands::stop_hosting,
            commands::host_address,
            commands::toggle_handout_public,
            commands::toggle_handout_share,
            commands::open_handout_for_all,
            commands::open_handout_for_player,
            commands::list_game_maps,
            commands::set_active_map,
            commands::reroll_die,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
