mod dice;
mod models;

use axum::{routing::get, Router};
use models::{CharacterSheet, ParsedDocument};
use std::fs;
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
            load_character_sheet,
            save_character_sheet,
            execute_roll
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn load_character_sheet(path: String) -> Result<ParsedDocument, String> {
    let file_content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read file at {}: {}", path, e))?;

    let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
    let parsed = matter.parse(&file_content);

    let frontmatter = parsed
        .data
        .as_ref()
        .ok_or("No YAML frontmatter found in file")?;

    let character_data: CharacterSheet = frontmatter
        .deserialize()
        .map_err(|e| format!("Invalid character sheet schema: {}", e))?;

    Ok(ParsedDocument {
        data: character_data,
        body: parsed.content,
    })
}

#[tauri::command]
fn save_character_sheet(path: String, data: CharacterSheet, body: String) -> Result<(), String> {
    // 1. Serialize the Rust struct back into a strict YAML string
    let yaml_str =
        serde_yaml::to_string(&data).map_err(|e| format!("Failed to serialize YAML: {}", e))?;

    // 2. Reconstruct the Obsidian Markdown format
    let full_content = format!("---\n{}---\n{}", yaml_str, body);

    // 3. Atomic Write: Write to a .tmp file first
    let tmp_path = format!("{}.tmp", path);
    fs::write(&tmp_path, &full_content)
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;

    // 4. Atomic Write: Rename the .tmp file to overwrite the original instantly
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to overwrite original file: {}", e))?;

    Ok(())
}

#[tauri::command]
fn execute_roll(pool: Vec<dice::StepDice>) -> Result<dice::RollResult, String> {
    dice::StepDice::roll_pool(&pool)
}

async fn ws_handler() {
    // WebSocket real-time sync
}
