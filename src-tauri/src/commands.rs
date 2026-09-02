//! Tauri IPC handlers (the bridge to React).
//!
//! Handlers stay thin: they read a document, delegate to `models`, `effects`,
//! `dice` or `rules`, persist atomically through `storage`, and hand the new
//! state back to the frontend. All game math happens in the backend so the UI
//! can never disagree with the sheet on disk.

use serde::{Deserialize, Serialize};

use crate::dice::{roll_freeform, roll_pool_entries, RollResult, StepDice};
use crate::effects::{resolve_test, EntryBehavior, ResolvedPool, TestRequest};
use crate::models::{
    Attribute, CharacterSheet, ParsedDocument, ResourceChange, ResourceKind, SaveState,
};
use crate::rules::{self, BuiltinDefinition, SkillDefinition};
use crate::storage;

/// Loads a document, applies it through `mutation`, then validates and writes it
/// back atomically. The Markdown body is preserved untouched.
fn mutate<F>(path: &str, mutation: F) -> Result<CharacterSheet, String>
where
    F: FnOnce(&mut CharacterSheet) -> Result<(), String>,
{
    let mut document = storage::read_document(path)?;
    mutation(&mut document.data)?;
    document.data.validate()?;
    storage::write_document(path, &document.data, &document.body)?;
    Ok(document.data)
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn load_character_sheet(path: String) -> Result<ParsedDocument, String> {
    let document = storage::read_document(&path)?;
    for note in &document.notes {
        tracing::info!(%path, note, "character sheet normalized on load");
    }
    Ok(document)
}

#[tauri::command]
pub fn save_character_sheet(
    path: String,
    data: CharacterSheet,
    body: String,
) -> Result<(), String> {
    storage::write_document(&path, &data, &body)
}

/// Scaffolds a canonical sheet seeded with the default skill catalog (§4.5).
#[tauri::command]
pub fn create_character_sheet(
    path: String,
    name: String,
    profile: String,
    occupation: String,
) -> Result<ParsedDocument, String> {
    let sheet = CharacterSheet::new(&name, &profile, &occupation);
    sheet.validate()?;
    let body = format!(
        "# Histórico do Personagem\n\nAnotações livres de {}.\n",
        sheet.name
    );
    storage::write_document(&path, &sheet, &body)?;
    Ok(ParsedDocument {
        data: sheet,
        body,
        notes: Vec::new(),
    })
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

/// Rolls a bare pool of step dice. Kept for the original IPC contract.
#[tauri::command]
pub fn execute_roll(pool: Vec<StepDice>) -> Result<RollResult, String> {
    StepDice::roll_pool(&pool)
}

/// Free dice roller. Accepts any supported die size, including the d20 (§4.3).
#[tauri::command]
pub fn roll_dice(sides: Vec<u8>, secret: Option<bool>) -> Result<RollResult, String> {
    roll_freeform(&sides, secret.unwrap_or(false))
}

/// Builds the pool for a test without rolling it, so the UI can show the player
/// exactly which dice and effects are about to be used.
#[tauri::command]
pub fn preview_test(path: String, request: TestRequest) -> Result<ResolvedPool, String> {
    let document = storage::read_document(&path)?;
    resolve_test(&document.data, &request)
}

/// A resolved test: the pool that was assembled and the result of rolling it.
#[derive(Debug, Serialize, Deserialize)]
pub struct TestOutcome {
    pub pool: ResolvedPool,
    pub result: RollResult,
}

/// Rolls `Atributo + Perícia` plus any active or triggered effects (§4.10).
#[tauri::command]
pub fn roll_test(path: String, request: TestRequest) -> Result<TestOutcome, String> {
    let document = storage::read_document(&path)?;
    let pool = resolve_test(&document.data, &request)?;
    let result = roll_pool_entries(&pool.to_pool_entries(), pool.label.clone(), pool.secret)?;
    Ok(TestOutcome { pool, result })
}

// ---------------------------------------------------------------------------
// Resources and saving throws
// ---------------------------------------------------------------------------

/// Applies a signed delta to PV or PD and returns the new sheet.
///
/// The arithmetic and clamping happen here rather than in the UI so the resource
/// bars and the HUD can never drift apart from the file (§4.4).
#[tauri::command]
pub fn modify_resource(
    path: String,
    resource: String,
    delta: i32,
) -> Result<CharacterSheet, String> {
    let kind = ResourceKind::from_key(&resource)
        .ok_or_else(|| format!("Invalid resource type: {}", resource))?;
    mutate(&path, |sheet| {
        sheet.apply_resource_delta(kind, delta);
        Ok(())
    })
}

/// Same as [`modify_resource`], but also reports whether the change triggered a
/// saving throw or reset an existing one.
#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceOutcome {
    pub character: CharacterSheet,
    pub change: ResourceChange,
    /// Skill the player must now roll, when the resource hit zero.
    pub save_skill: Option<String>,
    pub save_dc: Option<i32>,
}

#[tauri::command]
pub fn apply_resource_change(
    path: String,
    resource: String,
    delta: i32,
) -> Result<ResourceOutcome, String> {
    let kind = ResourceKind::from_key(&resource)
        .ok_or_else(|| format!("Invalid resource type: {}", resource))?;

    let mut document = storage::read_document(&path)?;
    let change = document.data.apply_resource_delta(kind, delta);
    document.data.validate()?;
    storage::write_document(&path, &document.data, &document.body)?;

    let downed = document.data.is_downed(kind);
    Ok(ResourceOutcome {
        save_skill: downed.then(|| rules::death_save_skill(kind).to_string()),
        save_dc: downed.then(|| document.data.death_saves.get(kind).dc),
        change,
        character: document.data,
    })
}

/// Outcome of a death saving throw (§4.13).
#[derive(Debug, Serialize, Deserialize)]
pub struct DeathSaveOutcome {
    pub resource: ResourceKind,
    pub result: RollResult,
    /// DC that had to be beaten on this attempt.
    pub dc: i32,
    pub success: bool,
    /// Saving throw state after the attempt, including the next DC.
    pub state: SaveState,
    pub character: CharacterSheet,
}

/// Rolls the saving throw a depleted resource demands: Vigor for PV, Disciplina
/// for PD. On success the DC climbs by 3; on failure the character is flagged so
/// the HUD and map token render the failed state.
#[tauri::command]
pub fn roll_death_save(path: String, resource: String) -> Result<DeathSaveOutcome, String> {
    let kind = ResourceKind::from_key(&resource)
        .ok_or_else(|| format!("Invalid resource type: {}", resource))?;

    let mut document = storage::read_document(&path)?;
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
    storage::write_document(&path, &document.data, &document.body)?;

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

/// Sets an attribute die. Values outside the ladder are normalized on the way in.
#[tauri::command]
pub fn set_attribute(
    path: String,
    attribute: String,
    value: StepDice,
) -> Result<CharacterSheet, String> {
    let attribute = Attribute::from_key(&attribute)
        .ok_or_else(|| format!("Invalid attribute: {}", attribute))?;
    mutate(&path, |sheet| {
        sheet.attributes.set(attribute, value);
        Ok(())
    })
}

/// Steps an attribute up or down the ladder, clamped to 4..=12 (§4.5).
#[tauri::command]
pub fn step_attribute(
    path: String,
    attribute: String,
    steps: i32,
) -> Result<CharacterSheet, String> {
    let attribute = Attribute::from_key(&attribute)
        .ok_or_else(|| format!("Invalid attribute: {}", attribute))?;
    mutate(&path, |sheet| {
        let stepped = sheet.attributes.get(attribute).apply_steps(steps);
        sheet.attributes.set(attribute, stepped);
        Ok(())
    })
}

#[tauri::command]
pub fn set_skill_value(
    path: String,
    skill_id: String,
    value: StepDice,
) -> Result<CharacterSheet, String> {
    mutate(&path, |sheet| sheet.set_skill_value(&skill_id, value))
}

#[tauri::command]
pub fn step_skill(path: String, skill_id: String, steps: i32) -> Result<CharacterSheet, String> {
    mutate(&path, |sheet| {
        let skill = sheet
            .skill_mut(&skill_id)
            .ok_or_else(|| format!("Unknown skill id: {}", skill_id))?;
        skill.value = skill.value.apply_steps(steps);
        Ok(())
    })
}

/// Toggles a step-driven ability or inventory entry on or off (§4.8).
#[tauri::command]
pub fn toggle_entry(
    path: String,
    entry_id: String,
    active: bool,
) -> Result<CharacterSheet, String> {
    mutate(&path, |sheet| {
        let entry = sheet
            .entry_mut(&entry_id)
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

/// The fixed built-in Buff/Debuff library (§4.9).
#[tauri::command]
pub fn list_builtin_effects() -> Vec<BuiltinDefinition> {
    rules::BUILTIN_EFFECTS.to_vec()
}

/// The default skill mappings, for sheet creation and the skill picker (§4.5).
#[tauri::command]
pub fn list_default_skills() -> Vec<SkillDefinition> {
    rules::DEFAULT_SKILLS.to_vec()
}

/// Applies one of the built-in standing effects to the character.
#[tauri::command]
pub fn apply_builtin_effect(
    path: String,
    effect_id: String,
    magnitude: Option<u32>,
) -> Result<CharacterSheet, String> {
    let definition = rules::builtin_definition(&effect_id)
        .ok_or_else(|| format!("Unknown built-in effect: {}", effect_id))?;
    if definition.per_test {
        return Err(format!(
            "'{}' is applied to a single test and is not a standing effect.",
            definition.name
        ));
    }
    let effect = rules::builtin(&effect_id, magnitude)?;
    mutate(&path, |sheet| {
        sheet
            .active_effects
            .retain(|existing| !existing.id.eq_ignore_ascii_case(&effect.id));
        sheet.active_effects.push(effect);
        Ok(())
    })
}

#[tauri::command]
pub fn remove_active_effect(path: String, effect_id: String) -> Result<CharacterSheet, String> {
    mutate(&path, |sheet| {
        let before = sheet.active_effects.len();
        sheet
            .active_effects
            .retain(|existing| !existing.id.eq_ignore_ascii_case(&effect_id));
        if sheet.active_effects.len() == before {
            return Err(format!("No active effect with id: {}", effect_id));
        }
        Ok(())
    })
}

/// What the three-dot menu needs to render an entry and send it to chat (§4.7).
#[derive(Debug, Serialize, Deserialize)]
pub struct EntrySummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub active: bool,
    pub behavior: EntryBehavior,
    /// Portuguese one-liners describing each effect.
    pub effects: Vec<String>,
}

#[tauri::command]
pub fn describe_entry(path: String, entry_id: String) -> Result<EntrySummary, String> {
    let document = storage::read_document(&path)?;
    let entry = document
        .data
        .entry(&entry_id)
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
// Multi-sheet access (§4.6)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn grant_sheet_access(path: String, reference: String) -> Result<CharacterSheet, String> {
    mutate(&path, |sheet| {
        if !sheet
            .accessible_sheets
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(&reference))
        {
            sheet.accessible_sheets.push(reference.clone());
        }
        Ok(())
    })
}

#[tauri::command]
pub fn revoke_sheet_access(path: String, reference: String) -> Result<CharacterSheet, String> {
    mutate(&path, |sheet| {
        sheet
            .accessible_sheets
            .retain(|existing| !existing.eq_ignore_ascii_case(&reference));
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::effects::{Effect, EffectOperation, EffectUnit};
    use crate::models::Entry;

    /// Creates a scratch sheet on disk and returns its path.
    fn scratch(tag: &str) -> String {
        let dir = std::env::temp_dir().join(format!("guia-commands-{tag}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("ficha.md").to_string_lossy().into_owned();

        create_character_sheet(
            path.clone(),
            "Elian Thorne".into(),
            "Combatente".into(),
            "Mercenário".into(),
        )
        .unwrap();
        set_attribute(path.clone(), "physical".into(), StepDice::D8).unwrap();
        set_skill_value(path.clone(), "furtividade".into(), StepDice::D6).unwrap();
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
        let document = load_character_sheet(path).unwrap();
        assert_eq!(document.data.name, "Elian Thorne");
        assert_eq!(document.data.attributes.physical, StepDice::D8);
        assert_eq!(document.data.skill("furtividade").unwrap().value, StepDice::D6);
        assert!(document.body.contains("Histórico do Personagem"));
    }

    #[test]
    fn a_test_previews_the_same_pool_it_rolls() {
        let path = scratch("preview");
        let request = TestRequest {
            skill_id: Some("furtividade".into()),
            ..Default::default()
        };
        let preview = preview_test(path.clone(), request.clone()).unwrap();
        assert_eq!(
            preview.dice.iter().map(|d| d.sides).collect::<Vec<_>>(),
            vec![8, 6]
        );

        let outcome = roll_test(path, request).unwrap();
        assert_eq!(outcome.pool.label, "Teste de Físico (Furtividade)");
        assert_eq!(outcome.result.dice.len(), 2);
        assert!((1..=8).contains(&outcome.result.rolls[0]));
        assert!((1..=6).contains(&outcome.result.rolls[1]));
    }

    #[test]
    fn a_standing_debuff_changes_the_next_pool() {
        let path = scratch("debuff");
        apply_builtin_effect(path.clone(), "machucado".into(), None).unwrap();
        let preview = preview_test(
            path.clone(),
            TestRequest {
                skill_id: Some("furtividade".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(preview.dice[0].sides, 6, "Físico d8 -1 passo");

        remove_active_effect(path.clone(), "machucado".into()).unwrap();
        let preview = preview_test(
            path,
            TestRequest {
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
        assert!(apply_builtin_effect(path.clone(), "ajuda".into(), Some(2)).is_err());
        assert!(apply_builtin_effect(path, "inexistente".into(), None).is_err());
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

        assert!(toggle_entry(path.clone(), "reflexos".into(), true).is_err());
        let sheet = toggle_entry(path.clone(), "postura".into(), true).unwrap();
        assert!(sheet.entry("postura").unwrap().active);

        let summary = describe_entry(path, "reflexos".into()).unwrap();
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
            path,
            TestRequest {
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
        let sheet = modify_resource(path.clone(), "hp".into(), -3).unwrap();
        assert_eq!(sheet.resources.hp.current, 7);
        let reloaded = load_character_sheet(path.clone()).unwrap();
        assert_eq!(reloaded.data.resources.hp.current, 7);

        assert!(modify_resource(path, "mana".into(), -1).is_err());
    }

    #[test]
    fn dropping_to_zero_reports_the_saving_throw_to_come() {
        let path = scratch("downed");
        let outcome = apply_resource_change(path.clone(), "hp".into(), -100).unwrap();
        assert_eq!(outcome.change.current, 0);
        assert!(outcome.change.triggered_save);
        assert_eq!(outcome.save_skill.as_deref(), Some("vigor"));
        assert_eq!(outcome.save_dc, Some(7));

        let outcome = apply_resource_change(path, "hp".into(), 4).unwrap();
        assert!(outcome.change.recovered);
        assert!(outcome.save_skill.is_none());
    }

    #[test]
    fn death_saves_only_run_while_the_resource_is_empty() {
        let path = scratch("saves");
        assert!(roll_death_save(path.clone(), "hp".into()).is_err());

        modify_resource(path.clone(), "hp".into(), -100).unwrap();
        let outcome = roll_death_save(path.clone(), "hp".into()).unwrap();
        assert_eq!(outcome.dc, 7);
        assert_eq!(outcome.resource, ResourceKind::Hp);
        assert!(outcome.result.label.contains("Vigor"));
        if outcome.success {
            assert_eq!(outcome.state.dc, 10);
        } else {
            assert!(outcome.state.failed);
            assert_eq!(outcome.state.dc, 7);
        }

        // Healing above zero always resets the ladder (§4.13).
        modify_resource(path.clone(), "hp".into(), 5).unwrap();
        let sheet = load_character_sheet(path).unwrap().data;
        assert_eq!(sheet.death_saves.hp.dc, 7);
        assert!(!sheet.death_saves.hp.failed);
    }

    #[test]
    fn the_pd_save_rolls_disciplina() {
        let path = scratch("pd");
        modify_resource(path.clone(), "dp".into(), -100).unwrap();
        let outcome = roll_death_save(path, "dp".into()).unwrap();
        assert!(outcome.result.label.contains("Disciplina"));
    }

    #[test]
    fn stepping_clamps_instead_of_failing() {
        let path = scratch("step");
        let sheet = step_attribute(path.clone(), "physical".into(), 9).unwrap();
        assert_eq!(sheet.attributes.physical, StepDice::D12);
        let sheet = step_skill(path.clone(), "furtividade".into(), -9).unwrap();
        assert_eq!(sheet.skill("furtividade").unwrap().value, StepDice::D4);
        assert!(step_skill(path, "inexistente".into(), 1).is_err());
    }

    #[test]
    fn sheet_access_can_be_granted_and_revoked() {
        let path = scratch("access");
        let sheet = grant_sheet_access(path.clone(), "personagens/joao.md".into()).unwrap();
        assert_eq!(sheet.accessible_sheets.len(), 1);
        // Granting twice is idempotent.
        let sheet = grant_sheet_access(path.clone(), "personagens/joao.md".into()).unwrap();
        assert_eq!(sheet.accessible_sheets.len(), 1);
        // A reference that escapes the campaign directory is rejected on save.
        assert!(grant_sheet_access(path.clone(), "../fora.md".into()).is_err());
        let sheet = revoke_sheet_access(path, "personagens/joao.md".into()).unwrap();
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
        let result = execute_roll(pool).unwrap();
        assert_eq!(result.rolls.len(), 2);

        let result = roll_dice(vec![20], Some(true)).unwrap();
        assert!(result.secret);
        assert!((1..=20).contains(&result.rolls[0]));
    }
}
