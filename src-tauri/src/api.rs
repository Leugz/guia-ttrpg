//! Application services: every operation the game supports, expressed once.
//!
//! These functions know nothing about Tauri or Axum. `commands.rs` exposes them
//! over IPC for the local window and `network::session` exposes the same
//! functions over the LAN socket, so a joined player and the GM run identical
//! rules against identical code. Whenever a sheet is written, connected clients
//! are notified so every open copy of that sheet refreshes.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::campaign;
use crate::dice::{roll_freeform, roll_pool_entries, RollResult, StepDice};
use crate::effects::{resolve_test, EntryBehavior, ResolvedPool, TestRequest};
use crate::models::{
    Attribute, CharacterSheet, ParsedDocument, ResourceChange, ResourceKind, SaveState,
};
use crate::network::protocol::{ServerMessage, Target};
use crate::rules::{self, BuiltinDefinition, SkillDefinition};
use crate::state;
use crate::storage;

// ---------------------------------------------------------------------------
// Change notification
// ---------------------------------------------------------------------------

/// Tell every connected client that a sheet changed. The sheet id is the file
/// name, which is exactly what clients address sheets by.
fn notify_sheet(path: &str, sheet: &CharacterSheet) {
    let Some(sheet_id) = Path::new(path).file_name().and_then(|name| name.to_str()) else {
        return;
    };
    state::publish(
        Target::All,
        &ServerMessage::SheetUpdate {
            sheet_id: sheet_id.to_string(),
            sheet: sheet.clone(),
        },
    );
}

/// Read, mutate, validate, write, announce.
fn mutate<F>(path: &str, mutation: F) -> Result<CharacterSheet, String>
where
    F: FnOnce(&mut CharacterSheet) -> Result<(), String>,
{
    let mut document = storage::read_document(path)?;
    mutation(&mut document.data)?;
    document.data.validate()?;
    storage::write_document(path, &document.data, &document.body)?;
    notify_sheet(path, &document.data);
    Ok(document.data)
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

pub fn load_character_sheet(path: &str) -> Result<ParsedDocument, String> {
    let document = storage::read_document(path)?;
    for note in &document.notes {
        tracing::info!(%path, note, "character sheet normalized on load");
    }
    Ok(document)
}

pub fn save_character_sheet(path: &str, data: CharacterSheet, body: &str) -> Result<(), String> {
    storage::write_document(path, &data, body)?;
    notify_sheet(path, &data);
    Ok(())
}

pub fn create_character_sheet(
    path: &str,
    name: &str,
    profile: &str,
    occupation: &str,
) -> Result<ParsedDocument, String> {
    let sheet = CharacterSheet::new(name, profile, occupation);
    sheet.validate()?;
    let body = format!(
        "# Histórico do Personagem\n\nAnotações livres de {}.\n",
        sheet.name
    );
    storage::write_document(path, &sheet, &body)?;
    Ok(ParsedDocument {
        data: sheet,
        body,
        notes: Vec::new(),
    })
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

pub fn execute_roll(pool: &[StepDice]) -> Result<RollResult, String> {
    StepDice::roll_pool(pool)
}

pub fn roll_dice(sides: &[u8], secret: bool) -> Result<RollResult, String> {
    roll_freeform(sides, secret)
}

pub fn preview_test(path: &str, request: &TestRequest) -> Result<ResolvedPool, String> {
    let document = storage::read_document(path)?;
    resolve_test(&document.data, request)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestOutcome {
    pub pool: ResolvedPool,
    pub result: RollResult,
}

pub fn roll_test(path: &str, request: &TestRequest) -> Result<TestOutcome, String> {
    let document = storage::read_document(path)?;
    let pool = resolve_test(&document.data, request)?;
    let result = roll_pool_entries(&pool.to_pool_entries(), pool.label.clone(), pool.secret)?;
    Ok(TestOutcome { pool, result })
}

// ---------------------------------------------------------------------------
// Resources and saving throws
// ---------------------------------------------------------------------------

pub fn modify_resource(path: &str, resource: &str, delta: i32) -> Result<CharacterSheet, String> {
    let kind = ResourceKind::from_key(resource)
        .ok_or_else(|| format!("Invalid resource type: {}", resource))?;
    mutate(path, |sheet| {
        sheet.apply_resource_delta(kind, delta);
        Ok(())
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceOutcome {
    pub character: CharacterSheet,
    pub change: ResourceChange,
    pub save_skill: Option<String>,
    pub save_dc: Option<i32>,
}

pub fn apply_resource_change(
    path: &str,
    resource: &str,
    delta: i32,
) -> Result<ResourceOutcome, String> {
    let kind = ResourceKind::from_key(resource)
        .ok_or_else(|| format!("Invalid resource type: {}", resource))?;

    let mut document = storage::read_document(path)?;
    let change = document.data.apply_resource_delta(kind, delta);
    document.data.validate()?;
    storage::write_document(path, &document.data, &document.body)?;
    notify_sheet(path, &document.data);

    let downed = document.data.is_downed(kind);
    Ok(ResourceOutcome {
        save_skill: downed.then(|| rules::death_save_skill(kind).to_string()),
        save_dc: downed.then(|| document.data.death_saves.get(kind).dc),
        change,
        character: document.data,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeathSaveOutcome {
    pub resource: ResourceKind,
    pub result: RollResult,
    pub dc: i32,
    pub success: bool,
    pub state: SaveState,
    pub character: CharacterSheet,
}

pub fn roll_death_save(path: &str, resource: &str) -> Result<DeathSaveOutcome, String> {
    let kind = ResourceKind::from_key(resource)
        .ok_or_else(|| format!("Invalid resource type: {}", resource))?;

    let mut document = storage::read_document(path)?;
    let (skill, dc) = document.data.death_save_test(kind)?;

    let skill_id = skill.id.clone();
    let skill_name = skill.name.clone();

    let pool = resolve_test(
        &document.data,
        &TestRequest {
            skill_id: Some(skill_id),
            ..Default::default()
        },
    )?;

    let label = format!("Salvamento de {} (CD {})", skill_name, dc);
    let result = roll_pool_entries(&pool.to_pool_entries(), label, false)?;
    let success = result.total_sum as i32 >= dc;

    let state = document.data.register_death_save(kind, success);
    document.data.validate()?;
    storage::write_document(path, &document.data, &document.body)?;
    notify_sheet(path, &document.data);

    Ok(DeathSaveOutcome {
        resource: kind,
        result,
        dc,
        success,
        state,
        character: document.data,
    })
}

// ---------------------------------------------------------------------------
// Sheet editing
// ---------------------------------------------------------------------------

pub fn set_attribute(
    path: &str,
    attribute: &str,
    value: StepDice,
) -> Result<CharacterSheet, String> {
    let attribute = Attribute::from_key(attribute)
        .ok_or_else(|| format!("Invalid attribute: {}", attribute))?;
    mutate(path, |sheet| {
        sheet.attributes.set(attribute, value);
        Ok(())
    })
}

pub fn step_attribute(path: &str, attribute: &str, steps: i32) -> Result<CharacterSheet, String> {
    let attribute = Attribute::from_key(attribute)
        .ok_or_else(|| format!("Invalid attribute: {}", attribute))?;
    mutate(path, |sheet| {
        let stepped = sheet.attributes.get(attribute).apply_steps(steps);
        sheet.attributes.set(attribute, stepped);
        Ok(())
    })
}

pub fn set_skill_value(
    path: &str,
    skill_id: &str,
    value: StepDice,
) -> Result<CharacterSheet, String> {
    mutate(path, |sheet| sheet.set_skill_value(skill_id, value))
}

pub fn step_skill(path: &str, skill_id: &str, steps: i32) -> Result<CharacterSheet, String> {
    mutate(path, |sheet| {
        let skill = sheet
            .skill_mut(skill_id)
            .ok_or_else(|| format!("Unknown skill id: {}", skill_id))?;
        skill.value = skill.value.apply_steps(steps);
        Ok(())
    })
}

pub fn toggle_entry(path: &str, entry_id: &str, active: bool) -> Result<CharacterSheet, String> {
    mutate(path, |sheet| {
        let entry = sheet
            .entry_mut(entry_id)
            .ok_or_else(|| format!("Unknown ability or inventory id: {}", entry_id))?;
        if matches!(entry.behavior(), EntryBehavior::Trigger) {
            return Err(format!(
                "'{}' only has trigger-driven effects and cannot be toggled.",
                entry.name
            ));
        }
        entry.active = active;
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

pub fn list_builtin_effects() -> Vec<BuiltinDefinition> {
    rules::BUILTIN_EFFECTS.to_vec()
}

pub fn list_default_skills() -> Vec<SkillDefinition> {
    rules::DEFAULT_SKILLS.to_vec()
}

pub fn apply_builtin_effect(
    path: &str,
    effect_id: &str,
    magnitude: Option<u32>,
) -> Result<CharacterSheet, String> {
    let definition = rules::builtin_definition(effect_id)
        .ok_or_else(|| format!("Unknown built-in effect: {}", effect_id))?;
    if definition.per_test {
        return Err(format!(
            "'{}' is applied to a single test and is not a standing effect.",
            definition.name
        ));
    }
    let effect = rules::builtin(effect_id, magnitude)?;
    mutate(path, |sheet| {
        sheet
            .active_effects
            .retain(|existing| !existing.id.eq_ignore_ascii_case(&effect.id));
        sheet.active_effects.push(effect);
        Ok(())
    })
}

pub fn remove_active_effect(path: &str, effect_id: &str) -> Result<CharacterSheet, String> {
    mutate(path, |sheet| {
        let before = sheet.active_effects.len();
        sheet
            .active_effects
            .retain(|existing| !existing.id.eq_ignore_ascii_case(effect_id));
        if sheet.active_effects.len() == before {
            return Err(format!("No active effect with id: {}", effect_id));
        }
        Ok(())
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntrySummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub active: bool,
    pub behavior: EntryBehavior,
    pub effects: Vec<String>,
}

pub fn describe_entry(path: &str, entry_id: &str) -> Result<EntrySummary, String> {
    let document = storage::read_document(path)?;
    let entry = document
        .data
        .entry(entry_id)
        .ok_or_else(|| format!("Unknown ability or inventory id: {}", entry_id))?;
    Ok(EntrySummary {
        id: entry.id.clone(),
        name: entry.name.clone(),
        description: entry.description.clone(),
        active: entry.active,
        behavior: entry.behavior(),
        effects: entry.effects.iter().map(|e| e.describe()).collect(),
    })
}

// ---------------------------------------------------------------------------
// Multi-sheet access
// ---------------------------------------------------------------------------

pub fn grant_sheet_access(path: &str, reference: &str) -> Result<CharacterSheet, String> {
    mutate(path, |sheet| {
        if !sheet
            .accessible_sheets
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(reference))
        {
            sheet.accessible_sheets.push(reference.to_string());
        }
        Ok(())
    })
}

pub fn revoke_sheet_access(path: &str, reference: &str) -> Result<CharacterSheet, String> {
    mutate(path, |sheet| {
        sheet
            .accessible_sheets
            .retain(|existing| !existing.eq_ignore_ascii_case(reference));
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::effects::{Effect, EffectOperation, EffectUnit};
    use crate::models::Entry;

    fn scratch(tag: &str) -> String {
        let dir = std::env::temp_dir().join(format!("guia-api-{tag}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("ficha.md").to_string_lossy().into_owned();

        create_character_sheet(&path, "Elian Thorne", "Combatente", "Mercenário").unwrap();

        set_attribute(&path, "physical", StepDice::D8).unwrap();
        set_skill_value(&path, "furtividade", StepDice::D6).unwrap();
        path
    }

    fn push_entry(path: &str, entry: Entry) {
        let mut document = storage::read_document(path).unwrap();
        document.data.abilities.push(entry);
        storage::write_document(path, &document.data, &document.body).unwrap();
    }

    #[test]
    fn a_new_sheet_round_trips_through_disk() {
        let path = scratch("create");
        let document = load_character_sheet(&path).unwrap();
        assert_eq!(document.data.name, "Elian Thorne");
        assert_eq!(document.data.attributes.physical, StepDice::D8);
        assert_eq!(
            document.data.skill("furtividade").unwrap().value,
            StepDice::D6
        );
        assert!(document.body.contains("Histórico do Personagem"));
    }

    #[test]
    fn a_test_previews_the_same_pool_it_rolls() {
        let path = scratch("preview");
        let request = TestRequest {
            skill_id: Some("furtividade".into()),
            ..Default::default()
        };

        let preview = preview_test(&path, &request).unwrap();
        assert_eq!(
            preview.dice.iter().map(|d| d.sides).collect::<Vec<_>>(),
            vec![8, 6]
        );

        let outcome = roll_test(&path, &request).unwrap();
        assert_eq!(outcome.pool.label, "Teste de Físico (Furtividade)");
        assert_eq!(outcome.result.dice.len(), 2);
        assert!((1..=8).contains(&outcome.result.rolls[0]));
        assert!((1..=6).contains(&outcome.result.rolls[1]));
    }

    #[test]
    fn a_standing_debuff_changes_the_next_pool() {
        let path = scratch("debuff");
        apply_builtin_effect(&path, "machucado", None).unwrap();

        let preview = preview_test(
            &path,
            &TestRequest {
                skill_id: Some("furtividade".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(preview.dice[0].sides, 6, "Físico d8 -1 passo");

        remove_active_effect(&path, "machucado").unwrap();
        let preview = preview_test(
            &path,
            &TestRequest {
                skill_id: Some("furtividade".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(preview.dice[0].sides, 8);
    }

    #[test]
    fn ajuda_is_not_a_standing_effect() {
        let path = scratch("ajuda");
        assert!(apply_builtin_effect(&path, "ajuda", Some(2)).is_err());
        assert!(apply_builtin_effect(&path, "inexistente", None).is_err());
    }

    #[test]
    fn only_toggle_entries_can_be_toggled() {
        let path = scratch("toggle");
        push_entry(
            &path,
            Entry {
                id: "reflexos".into(),
                name: "Reflexos".into(),
                description: "Adiciona um dado em esquivas.".into(),
                active: false,
                effects: vec![Effect {
                    operation: EffectOperation::Add,
                    quantity: 1,
                    unit: EffectUnit::Die(StepDice::D4),
                    target: Some("furtividade".into()),
                }],
            },
        );
        push_entry(
            &path,
            Entry {
                id: "postura".into(),
                name: "Postura Defensiva".into(),
                description: String::new(),
                active: false,
                effects: vec![Effect {
                    operation: EffectOperation::Advance,
                    quantity: 1,
                    unit: EffectUnit::Step,
                    target: None,
                }],
            },
        );

        assert!(toggle_entry(&path, "reflexos", true).is_err());

        let sheet = toggle_entry(&path, "postura", true).unwrap();
        assert!(sheet.entry("postura").unwrap().active);

        let summary = describe_entry(&path, "reflexos").unwrap();
        assert_eq!(summary.behavior, EntryBehavior::Trigger);
        assert_eq!(summary.effects, vec!["Adiciona 1 d4 em furtividade"]);
    }

    #[test]
    fn triggering_an_ability_widens_the_pool() {
        let path = scratch("trigger");
        push_entry(
            &path,
            Entry {
                id: "reflexos".into(),
                name: "Reflexos".into(),
                description: String::new(),
                active: false,
                effects: vec![Effect {
                    operation: EffectOperation::Add,
                    quantity: 1,
                    unit: EffectUnit::Die(StepDice::D4),
                    target: Some("furtividade".into()),
                }],
            },
        );

        let outcome = roll_test(
            &path,
            &TestRequest {
                skill_id: Some("furtividade".into()),
                triggered: vec!["reflexos".into()],
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(outcome.result.dice.len(), 3);
        assert_eq!(outcome.result.dice[2].source, "Reflexos");
    }

    #[test]
    fn damage_and_healing_persist_to_disk() {
        let path = scratch("resource");
        let sheet = modify_resource(&path, "hp", -3).unwrap();
        assert_eq!(sheet.resources.hp.current, 7);

        let reloaded = load_character_sheet(&path).unwrap();
        assert_eq!(reloaded.data.resources.hp.current, 7);

        assert!(modify_resource(&path, "mana", -1).is_err());
    }

    #[test]
    fn dropping_to_zero_reports_the_saving_throw_to_come() {
        let path = scratch("downed");
        let outcome = apply_resource_change(&path, "hp", -100).unwrap();
        assert_eq!(outcome.change.current, 0);
        assert!(outcome.change.triggered_save);
        assert_eq!(outcome.save_skill.as_deref(), Some("vigor"));
        assert_eq!(outcome.save_dc, Some(7));

        let outcome = apply_resource_change(&path, "hp", 4).unwrap();
        assert!(outcome.change.recovered);
        assert!(outcome.save_skill.is_none());
    }

    #[test]
    fn death_saves_only_run_while_the_resource_is_empty() {
        let path = scratch("saves");
        assert!(roll_death_save(&path, "hp").is_err());

        modify_resource(&path, "hp", -100).unwrap();
        let outcome = roll_death_save(&path, "hp").unwrap();
        assert_eq!(outcome.dc, 7);
        assert_eq!(outcome.resource, ResourceKind::Hp);
        assert!(outcome.result.label.contains("Vigor"));

        if outcome.success {
            assert_eq!(outcome.state.dc, 10);
        } else {
            assert!(outcome.state.failed);
            assert_eq!(outcome.state.dc, 7);
        }

        modify_resource(&path, "hp", 5).unwrap();
        let sheet = load_character_sheet(&path).unwrap().data;
        assert_eq!(sheet.death_saves.hp.dc, 7);
        assert!(!sheet.death_saves.hp.failed);
    }

    #[test]
    fn the_pd_save_rolls_disciplina() {
        let path = scratch("pd");
        modify_resource(&path, "dp", -100).unwrap();
        let outcome = roll_death_save(&path, "dp").unwrap();
        assert!(outcome.result.label.contains("Disciplina"));
    }

    #[test]
    fn stepping_clamps_instead_of_failing() {
        let path = scratch("step");
        let sheet = step_attribute(&path, "physical", 9).unwrap();
        assert_eq!(sheet.attributes.physical, StepDice::D12);

        let sheet = step_skill(&path, "furtividade", -9).unwrap();
        assert_eq!(sheet.skill("furtividade").unwrap().value, StepDice::D4);

        assert!(step_skill(&path, "inexistente", 1).is_err());
    }

    #[test]
    fn sheet_access_can_be_granted_and_revoked() {
        let path = scratch("access");
        let sheet = grant_sheet_access(&path, "personagens/joao.md").unwrap();
        assert_eq!(sheet.accessible_sheets.len(), 1);

        let sheet = grant_sheet_access(&path, "personagens/joao.md").unwrap();
        assert_eq!(sheet.accessible_sheets.len(), 1);

        assert!(grant_sheet_access(&path, "../fora.md").is_err());

        let sheet = revoke_sheet_access(&path, "personagens/joao.md").unwrap();
        assert!(sheet.accessible_sheets.is_empty());
    }

    #[test]
    fn the_catalog_commands_expose_the_fixed_rules() {
        assert_eq!(list_builtin_effects().len(), 4);
        assert_eq!(list_default_skills().len(), rules::DEFAULT_SKILLS.len());
    }

    #[test]
    fn the_legacy_roll_contract_still_accepts_string_dice() {
        let pool: Vec<StepDice> = serde_json::from_str(r#"["D8","D6"]"#).unwrap();
        assert_eq!(pool, vec![StepDice::D8, StepDice::D6]);
        let result = execute_roll(&pool).unwrap();
        assert_eq!(result.rolls.len(), 2);

        let result = roll_dice(&[20], true).unwrap();
        assert!(result.secret);
        assert!((1..=20).contains(&result.rolls[0]));
    }
}

use crate::models::Handout;

pub fn toggle_handout_public(root: &Path, handout_id: &str) -> Result<Handout, String> {
    let path = campaign::resolve_handout(root, handout_id)?;
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut handout = storage::parse_handout(handout_id, &raw)?;

    handout.is_public = !handout.is_public;

    let out = storage::render_handout(&handout)?;
    storage::write_atomic(&path, &out)?;

    state::publish(
        Target::All,
        &ServerMessage::HandoutUpdate {
            handout: handout.clone(),
        },
    );

    Ok(handout)
}

pub fn toggle_handout_share(
    root: &Path,
    handout_id: &str,
    target_client_id: &str,
) -> Result<Handout, String> {
    let path = campaign::resolve_handout(root, handout_id)?;
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut handout = storage::parse_handout(handout_id, &raw)?;

    let target = target_client_id.to_string();
    if handout.shared_with.contains(&target) {
        handout.shared_with.retain(|c| c != &target);
    } else {
        handout.shared_with.push(target);
    }

    let out = storage::render_handout(&handout)?;
    storage::write_atomic(&path, &out)?;

    state::publish(
        Target::All,
        &ServerMessage::HandoutUpdate {
            handout: handout.clone(),
        },
    );

    Ok(handout)
}

pub fn open_handout_for_all(root: &Path, handout_id: &str) -> Result<Handout, String> {
    let path = campaign::resolve_handout(root, handout_id)?;
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut handout = storage::parse_handout(handout_id, &raw)?;

    handout.is_public = true; // force — not a toggle

    let out = storage::render_handout(&handout)?;
    storage::write_atomic(&path, &out)?;

    state::publish(
        Target::All,
        &ServerMessage::HandoutUpdate {
            handout: handout.clone(),
        },
    );
    state::publish(
        Target::All,
        &ServerMessage::HandoutForceOpen {
            handout_id: handout.id.clone(),
            target: None,
        },
    );

    Ok(handout)
}

pub fn open_handout_for_player(
    root: &Path,
    handout_id: &str,
    target_client_id: &str,
) -> Result<Handout, String> {
    let path = campaign::resolve_handout(root, handout_id)?;
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut handout = storage::parse_handout(handout_id, &raw)?;

    let target = target_client_id.to_string();
    if !handout.shared_with.contains(&target) {
        handout.shared_with.push(target.clone()); // ensure — not a toggle
    }

    let out = storage::render_handout(&handout)?;
    storage::write_atomic(&path, &out)?;

    state::publish(
        Target::All,
        &ServerMessage::HandoutUpdate {
            handout: handout.clone(),
        },
    );
    // Only the target actually needs the "open now" instruction — this is
    // exactly what Target::Only already exists for.
    state::publish(
        Target::Only(vec![target]),
        &ServerMessage::HandoutForceOpen {
            handout_id: handout.id.clone(),
            target: Some(target_client_id.to_string()),
        },
    );

    Ok(handout)
}

/// The raw bytes of an image handout, base64-encoded. Joined clients have no
/// access to the host's filesystem, so this is what lets a player actually
/// see an image handout instead of just its metadata.
#[derive(Debug, Clone, Serialize)]
pub struct HandoutAsset {
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(rename = "dataBase64")]
    pub data_base64: String,
}

pub fn get_handout_asset(root: &Path, handout_id: &str) -> Result<HandoutAsset, String> {
    let path = campaign::resolve_handout(root, handout_id)?;
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let handout = storage::parse_handout(handout_id, &raw)?;

    if handout.content_type == "text" {
        return Err("This handout has no image asset.".into());
    }

    let asset_path = storage::resolve_asset_within(root, &handout.content)?;
    let bytes = std::fs::read(&asset_path)
        .map_err(|e| format!("Failed to read image at {}: {}", asset_path.display(), e))?;

    Ok(HandoutAsset {
        mime_type: storage::mime_for_asset(&asset_path).to_string(),
        data_base64: storage::base64_encode(&bytes),
    })
}
