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

    character_data.validate()?;

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
    let yaml_str =
        serde_yaml::to_string(&data).map_err(|e| format!("Failed to serialize YAML: {}", e))?;

    let full_content = format!("---\n{}---\n{}", yaml_str, body);
    let tmp_path = format!("{}.tmp", path);

    fs::write(&tmp_path, &full_content)
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to overwrite original file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn execute_roll(pool: Vec<StepDice>) -> Result<RollResult, String> {
    StepDice::roll_pool(&pool)
}

#[tauri::command]
pub fn modify_resource(
    path: String,
    resource: String,
    delta: i32,
) -> Result<CharacterSheet, String> {
    // 1. Read current state directly from disk
    let file_content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read file at {}: {}", path, e))?;

    let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
    let parsed = matter.parse(&file_content);
    let frontmatter = parsed
        .data
        .as_ref()
        .ok_or("No YAML frontmatter found in file")?;

    let mut character: CharacterSheet = frontmatter
        .deserialize()
        .map_err(|e| format!("Invalid character sheet schema: {}", e))?;

    // 2. Perform the math and clamp values securely in the backend
    match resource.as_str() {
        "hp" => {
            character.resources.hp.current =
                (character.resources.hp.current + delta).clamp(0, character.resources.hp.max);
        }
        "dp" => {
            character.resources.dp.current =
                (character.resources.dp.current + delta).clamp(0, character.resources.dp.max);
        }
        _ => return Err("Invalid resource type specified.".into()),
    }

    // 3. Validate against business rules before saving
    character.validate()?;

    // 4. Atomic Save
    let yaml_str = serde_yaml::to_string(&character)
        .map_err(|e| format!("Failed to serialize YAML: {}", e))?;

    let full_content = format!("---\n{}---\n{}", yaml_str, parsed.content);
    let tmp_path = format!("{}.tmp", path);

    fs::write(&tmp_path, &full_content)
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to overwrite original file: {}", e))?;

    // 5. Return the newly calculated state to React
    Ok(character)
}
