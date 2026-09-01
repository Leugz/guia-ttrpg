mod commands;
mod dice;
mod models;

use axum::{routing::get, Router};
use std::net::SocketAddr;
use tauri::Manager;

#[tokio::main]
async fn main() {
    tokio::spawn(async move {
        let app = Router::new().route("/ws", get(ws_handler));
        let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
        let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
        axum::serve(listener, app).await.unwrap();
    });

    tauri::Builder::default()
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_character_sheet,
            commands::save_character_sheet,
            commands::execute_roll
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn ws_handler() {
    // WebSocket real-time sync
}
