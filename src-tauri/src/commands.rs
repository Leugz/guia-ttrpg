use crate::dice::{RollResult, StepDice};
use crate::models::{CharacterSheet, ParsedDocument};
use std::fs;

#[tauri::command]
pub fn load_character_sheet(path: String) -> Result<ParsedDocument, String> {
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
pub fn save_character_sheet(
    path: String,
    data: CharacterSheet,
    body: String,
) -> Result<(), String> {
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
pub fn execute_roll(pool: Vec<StepDice>) -> Result<RollResult, String> {
    StepDice::roll_pool(&pool)
}
