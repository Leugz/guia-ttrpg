use std::path::PathBuf;
use std::sync::Arc;

use crate::api;
use crate::campaign;
use crate::dice::{RollResult, StepDice};
use crate::effects::{ResolvedPool, TestRequest};
use crate::error::{AppError, AppResult};
use crate::history;
use crate::models::{CharacterSheet, ParsedDocument};
use crate::network::protocol::SheetSummary;
use crate::network::{server, HostInfo};
use crate::rules::{BuiltinDefinition, SkillDefinition};
use crate::state::{self, AppState};
use crate::storage;

pub use crate::api::{DeathSaveOutcome, EntrySummary, ResourceOutcome, TestOutcome};

fn shared_state() -> AppResult<Arc<AppState>> {
    state::hub().ok_or_else(|| AppError::state("Application state is not initialised."))
}

#[tauri::command]
pub fn load_character_sheet(path: String) -> AppResult<ParsedDocument> {
    api::load_character_sheet(&path)
}

#[tauri::command]
pub fn save_character_sheet(path: String, data: CharacterSheet, body: String) -> AppResult<()> {
    api::save_character_sheet(&path, data, &body)
}

#[tauri::command]
pub fn create_character_sheet(
    path: String,
    name: String,
    profile: String,
    occupation: String,
) -> AppResult<ParsedDocument> {
    api::create_character_sheet(&path, &name, &profile, &occupation)
}

#[tauri::command]
pub fn execute_roll(pool: Vec<StepDice>) -> AppResult<RollResult> {
    api::execute_roll(&pool)
}

#[tauri::command]
pub fn roll_dice(sides: Vec<u8>, secret: Option<bool>) -> AppResult<RollResult> {
    api::roll_dice(&sides, secret.unwrap_or(false))
}

#[tauri::command]
pub fn preview_test(path: String, request: TestRequest) -> AppResult<ResolvedPool> {
    api::preview_test(&path, &request)
}

#[tauri::command]
pub fn roll_test(path: String, request: TestRequest) -> AppResult<TestOutcome> {
    api::roll_test(&path, &request)
}

#[tauri::command]
pub fn modify_resource(path: String, resource: String, delta: i16) -> AppResult<CharacterSheet> {
    api::modify_resource(&path, &resource, delta)
}

#[tauri::command]
pub fn apply_resource_change(
    path: String,
    resource: String,
    delta: i16,
) -> AppResult<ResourceOutcome> {
    api::apply_resource_change(&path, &resource, delta)
}

#[tauri::command]
pub fn roll_death_save(path: String, resource: String) -> AppResult<DeathSaveOutcome> {
    api::roll_death_save(&path, &resource)
}

#[tauri::command]
pub fn set_attribute(
    path: String,
    attribute: String,
    value: StepDice,
) -> AppResult<CharacterSheet> {
    api::set_attribute(&path, &attribute, value)
}

#[tauri::command]
pub fn step_attribute(path: String, attribute: String, steps: i32) -> AppResult<CharacterSheet> {
    api::step_attribute(&path, &attribute, steps)
}

#[tauri::command]
pub fn set_skill_value(
    path: String,
    skill_id: String,
    value: StepDice,
) -> AppResult<CharacterSheet> {
    api::set_skill_value(&path, &skill_id, value)
}

#[tauri::command]
pub fn step_skill(path: String, skill_id: String, steps: i32) -> AppResult<CharacterSheet> {
    api::step_skill(&path, &skill_id, steps)
}

#[tauri::command]
pub fn toggle_entry(path: String, entry_id: String, active: bool) -> AppResult<CharacterSheet> {
    api::toggle_entry(&path, &entry_id, active)
}

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
    magnitude: Option<u8>,
) -> AppResult<CharacterSheet> {
    api::apply_builtin_effect(&path, &effect_id, magnitude)
}

#[tauri::command]
pub fn remove_active_effect(path: String, effect_id: String) -> AppResult<CharacterSheet> {
    api::remove_active_effect(&path, &effect_id)
}

#[tauri::command]
pub fn describe_entry(path: String, entry_id: String) -> AppResult<EntrySummary> {
    api::describe_entry(&path, &entry_id)
}

#[tauri::command]
pub fn grant_sheet_access(path: String, reference: String) -> AppResult<CharacterSheet> {
    api::grant_sheet_access(&path, &reference)
}

#[tauri::command]
pub fn revoke_sheet_access(path: String, reference: String) -> AppResult<CharacterSheet> {
    api::revoke_sheet_access(&path, &reference)
}

#[tauri::command]
pub fn create_game_instance(
    app: tauri::AppHandle,
    game_id: String,
    act_id: String,
) -> AppResult<String> {
    let path = campaign::ensure_instance(&app, &game_id, &act_id)?;
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| AppError::invalid_input("Game instance path is not valid UTF-8."))
}

#[tauri::command]
pub fn delete_game_instance(
    app: tauri::AppHandle,
    game_id: String,
    act_id: String,
) -> AppResult<()> {
    campaign::delete_instance(&app, &game_id, &act_id)?;
    if let Ok(state) = shared_state() {
        let _ = history::clear(&state.db_path, &game_id);
    }
    Ok(())
}

#[tauri::command]
pub fn list_game_sheets(game_path: String) -> AppResult<Vec<SheetSummary>> {
    Ok(campaign::list_sheets(&PathBuf::from(game_path))?)
}

#[tauri::command]
pub fn load_board(game_path: String) -> AppResult<Vec<crate::models::MapToken>> {
    Ok(storage::read_board(std::path::Path::new(&game_path)))
}

#[tauri::command]
pub fn save_board(game_path: String, tokens: Vec<crate::models::MapToken>) -> AppResult<()> {
    Ok(storage::write_board(
        std::path::Path::new(&game_path),
        &tokens,
    )?)
}

#[tauri::command]
pub async fn start_hosting(
    game_id: String,
    game_path: String,
    client_id: String,
) -> AppResult<HostInfo> {
    let state = shared_state()?;
    Ok(server::start(state, game_id, PathBuf::from(game_path), client_id).await?)
}

#[tauri::command]
pub async fn stop_hosting() -> AppResult<()> {
    let state = shared_state()?;
    server::stop(state, "O mestre encerrou a sessão.").await;
    Ok(())
}

#[tauri::command]
pub async fn host_address() -> AppResult<Option<String>> {
    let state = shared_state()?;
    let session = state.session.read().await;
    Ok(session.as_ref().map(|session| session.address.clone()))
}

#[tauri::command]
pub async fn toggle_handout_public(
    game_root: String,
    handout_id: String,
) -> AppResult<crate::models::Handout> {
    api::toggle_handout_public(std::path::Path::new(&game_root), &handout_id)
}

#[tauri::command]
pub async fn toggle_handout_share(
    game_root: String,
    handout_id: String,
    target_client_id: String,
) -> AppResult<crate::models::Handout> {
    api::toggle_handout_share(
        std::path::Path::new(&game_root),
        &handout_id,
        &target_client_id,
    )
}

#[tauri::command]
pub fn list_game_handouts(game_path: String) -> AppResult<Vec<crate::models::Handout>> {
    Ok(crate::campaign::list_handouts(std::path::Path::new(
        &game_path,
    ))?)
}

#[tauri::command]
pub async fn open_handout_for_all(
    game_root: String,
    handout_id: String,
) -> AppResult<crate::models::Handout> {
    api::open_handout_for_all(std::path::Path::new(&game_root), &handout_id)
}

#[tauri::command]
pub async fn open_handout_for_player(
    game_root: String,
    handout_id: String,
    target_client_id: String,
) -> AppResult<crate::models::Handout> {
    api::open_handout_for_player(
        std::path::Path::new(&game_root),
        &handout_id,
        &target_client_id,
    )
}

#[tauri::command]
pub fn list_game_maps(game_path: String) -> AppResult<Vec<crate::models::MapDefinition>> {
    api::list_maps(std::path::Path::new(&game_path))
}

#[tauri::command]
pub async fn set_active_map(
    game_root: String,
    map_id: String,
) -> AppResult<Vec<crate::models::MapDefinition>> {
    api::set_active_map(std::path::Path::new(&game_root), &map_id)
}
