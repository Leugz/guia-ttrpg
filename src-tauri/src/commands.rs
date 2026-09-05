//! Tauri IPC adapter.
//!
//! Every handler here is a thin translation from IPC arguments to a call into
//! `api` (rules and persistence) or `network` (session lifecycle). Keeping the
//! logic out of this file is what lets the LAN server run the exact same code
//! paths for a joined player as the GM's own window runs locally.

use std::path::PathBuf;
use std::sync::Arc;

use crate::api;
use crate::campaign;
use crate::dice::{RollResult, StepDice};
use crate::effects::{ResolvedPool, TestRequest};
use crate::history;
use crate::models::{CharacterSheet, ParsedDocument};
use crate::network::protocol::SheetSummary;
use crate::network::{server, HostInfo};
use crate::rules::{BuiltinDefinition, SkillDefinition};
use crate::state::{self, AppState};

pub use crate::api::{DeathSaveOutcome, EntrySummary, ResourceOutcome, TestOutcome};

fn shared_state() -> Result<Arc<AppState>, String> {
    state::hub().ok_or_else(|| "Application state is not initialised.".to_string())
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn load_character_sheet(path: String) -> Result<ParsedDocument, String> {
    api::load_character_sheet(&path)
}

#[tauri::command]
pub fn save_character_sheet(
    path: String,
    data: CharacterSheet,
    body: String,
) -> Result<(), String> {
    api::save_character_sheet(&path, data, &body)
}

#[tauri::command]
pub fn create_character_sheet(
    path: String,
    name: String,
    profile: String,
    occupation: String,
) -> Result<ParsedDocument, String> {
    api::create_character_sheet(&path, &name, &profile, &occupation)
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn execute_roll(pool: Vec<StepDice>) -> Result<RollResult, String> {
    api::execute_roll(&pool)
}

#[tauri::command]
pub fn roll_dice(sides: Vec<u8>, secret: Option<bool>) -> Result<RollResult, String> {
    api::roll_dice(&sides, secret.unwrap_or(false))
}

#[tauri::command]
pub fn preview_test(path: String, request: TestRequest) -> Result<ResolvedPool, String> {
    api::preview_test(&path, &request)
}

#[tauri::command]
pub fn roll_test(path: String, request: TestRequest) -> Result<TestOutcome, String> {
    api::roll_test(&path, &request)
}

// ---------------------------------------------------------------------------
// Resources and saving throws
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn modify_resource(
    path: String,
    resource: String,
    delta: i32,
) -> Result<CharacterSheet, String> {
    api::modify_resource(&path, &resource, delta)
}

#[tauri::command]
pub fn apply_resource_change(
    path: String,
    resource: String,
    delta: i32,
) -> Result<ResourceOutcome, String> {
    api::apply_resource_change(&path, &resource, delta)
}

#[tauri::command]
pub fn roll_death_save(path: String, resource: String) -> Result<DeathSaveOutcome, String> {
    api::roll_death_save(&path, &resource)
}

// ---------------------------------------------------------------------------
// Sheet editing
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn set_attribute(
    path: String,
    attribute: String,
    value: StepDice,
) -> Result<CharacterSheet, String> {
    api::set_attribute(&path, &attribute, value)
}

#[tauri::command]
pub fn step_attribute(
    path: String,
    attribute: String,
    steps: i32,
) -> Result<CharacterSheet, String> {
    api::step_attribute(&path, &attribute, steps)
}

#[tauri::command]
pub fn set_skill_value(
    path: String,
    skill_id: String,
    value: StepDice,
) -> Result<CharacterSheet, String> {
    api::set_skill_value(&path, &skill_id, value)
}

#[tauri::command]
pub fn step_skill(path: String, skill_id: String, steps: i32) -> Result<CharacterSheet, String> {
    api::step_skill(&path, &skill_id, steps)
}

#[tauri::command]
pub fn toggle_entry(
    path: String,
    entry_id: String,
    active: bool,
) -> Result<CharacterSheet, String> {
    api::toggle_entry(&path, &entry_id, active)
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_builtin_effects() -> Vec<BuiltinDefinition> {
    api::list_builtin_effects()
}

#[tauri::command]
pub fn list_default_skills() -> Vec<SkillDefinition> {
    api::list_default_skills()
}

#[tauri::command]
pub fn apply_builtin_effect(
    path: String,
    effect_id: String,
    magnitude: Option<u32>,
) -> Result<CharacterSheet, String> {
    api::apply_builtin_effect(&path, &effect_id, magnitude)
}

#[tauri::command]
pub fn remove_active_effect(path: String, effect_id: String) -> Result<CharacterSheet, String> {
    api::remove_active_effect(&path, &effect_id)
}

#[tauri::command]
pub fn describe_entry(path: String, entry_id: String) -> Result<EntrySummary, String> {
    api::describe_entry(&path, &entry_id)
}

// ---------------------------------------------------------------------------
// Multi-sheet access
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn grant_sheet_access(path: String, reference: String) -> Result<CharacterSheet, String> {
    api::grant_sheet_access(&path, &reference)
}

#[tauri::command]
pub fn revoke_sheet_access(path: String, reference: String) -> Result<CharacterSheet, String> {
    api::revoke_sheet_access(&path, &reference)
}

// ---------------------------------------------------------------------------
// Game lifecycle
// ---------------------------------------------------------------------------

/// Create (or reuse) an independent, mutable copy of an Act.
///
/// Replaces the previous implementation, which resolved templates from a path
/// hardcoded to one developer's home directory and therefore failed on every
/// other machine and in every packaged build.
#[tauri::command]
pub fn create_game_instance(
    app: tauri::AppHandle,
    game_id: String,
    act_id: String,
) -> Result<String, String> {
    let path = campaign::ensure_instance(&app, &game_id, &act_id)?;
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| "Game instance path is not valid UTF-8.".to_string())
}

#[tauri::command]
pub fn delete_game_instance(
    app: tauri::AppHandle,
    game_id: String,
    act_id: String,
) -> Result<(), String> {
    campaign::delete_instance(&app, &game_id, &act_id)?;
    if let Ok(state) = shared_state() {
        let _ = history::clear(&state.db_path, &game_id);
    }
    Ok(())
}

/// List the characters a table offers. The selection screen used to hardcode
/// the Act 1 party, which meant a joined client had no way to discover them.
#[tauri::command]
pub fn list_game_sheets(game_path: String) -> Result<Vec<SheetSummary>, String> {
    campaign::list_sheets(&PathBuf::from(game_path))
}

/// Start hosting. Returns the address to share with players.
#[tauri::command]
pub async fn start_hosting(
    game_id: String,
    game_path: String,
    client_id: String,
) -> Result<HostInfo, String> {
    let state = shared_state()?;
    server::start(state, game_id, PathBuf::from(game_path), client_id).await
}

#[tauri::command]
pub async fn stop_hosting() -> Result<(), String> {
    let state = shared_state()?;
    server::stop(state, "O mestre encerrou a sessão.").await;
    Ok(())
}

/// The address players should dial, or `null` when not hosting.
#[tauri::command]
pub async fn host_address() -> Result<Option<String>, String> {
    let state = shared_state()?;
    let session = state.session.read().await;
    Ok(session.as_ref().map(|session| session.address.clone()))
}

#[tauri::command]
pub async fn toggle_handout_public(
    game_root: String,
    handout_id: String,
) -> Result<crate::models::Handout, String> {
    api::toggle_handout_public(std::path::Path::new(&game_root), &handout_id)
}

#[tauri::command]
pub async fn toggle_handout_share(
    game_root: String,
    handout_id: String,
    target_client_id: String,
) -> Result<crate::models::Handout, String> {
    api::toggle_handout_share(
        std::path::Path::new(&game_root),
        &handout_id,
        &target_client_id,
    )
}

#[tauri::command]
pub fn list_game_handouts(game_path: String) -> Result<Vec<crate::models::Handout>, String> {
    crate::campaign::list_handouts(std::path::Path::new(&game_path))
}
