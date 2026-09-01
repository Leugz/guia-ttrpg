use tauri::Manager;
use axum::{routing::get, Router};
use std::net::SocketAddr;

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
            // Tauri 2 API change: get_webview_window
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_markdown_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn read_markdown_file(_path: String) -> Result<String, String> {
    Ok("Parsed YAML and Body".into())
}

async fn ws_handler() {
    // WebSocket real-time sync for tokens, chat, and dice logic
}
