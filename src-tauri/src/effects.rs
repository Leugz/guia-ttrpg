use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;

use crate::dice::{PoolEntry, StepDice, MAX_POOL_SIZE};
use crate::models::{Attribute, CharacterSheet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EffectOperation {
    Add,
    Subtract,
    Advance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EffectUnit {
    Step,
    Die(StepDice),
}

impl EffectUnit {
    pub fn is_step(self) -> bool {
        matches!(self, EffectUnit::Step)
    }

    pub fn label(self) -> String {
        match self {
            EffectUnit::Step => "passo".to_string(),
            EffectUnit::Die(die) => die.notation(),
        }
    }
}

impl Serialize for EffectUnit {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            EffectUnit::Step => serializer.serialize_str("step"),
            EffectUnit::Die(die) => serializer.serialize_u8(die.sides()),
        }
    }
}

impl<'de> Deserialize<'de> for EffectUnit {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(EffectUnitVisitor)
    }
}

struct EffectUnitVisitor;

impl<'de> Visitor<'de> for EffectUnitVisitor {
    type Value = EffectUnit;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("either \"step\" or a die size of 4, 6, 8, 10 or 12")
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> Result<EffectUnit, E> {
        Ok(EffectUnit::Die(
            StepDice::from_sides(value).unwrap_or_else(|| {
                let normalized = StepDice::nearest(value);
                tracing::warn!(
                    invalid = value,
                    normalized = normalized.sides(),
                    "unsupported effect unit normalized to nearest valid die"
                );
                normalized
            }),
        ))
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> Result<EffectUnit, E> {
        self.visit_i64(value as i64)
    }

    fn visit_f64<E: de::Error>(self, value: f64) -> Result<EffectUnit, E> {
        self.visit_i64(value.round() as i64)
    }

    fn visit_str<E: de::Error>(self, value: &str) -> Result<EffectUnit, E> {
        let normalized = value.trim().to_lowercase();
        if normalized == "step" || normalized == "passo" {
            return Ok(EffectUnit::Step);
        }
        if let Some(die) = StepDice::from_legacy_str(&normalized) {
            return Ok(EffectUnit::Die(die));
        }
        Err(de::Error::custom(format!(
            "Invalid effect unit: {}. Expected \"step\" or 4, 6, 8, 10, 12.",
            value
        )))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Effect {
    pub operation: EffectOperation,
    pub quantity: u32,
    pub unit: EffectUnit,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
}

pub const MAX_EFFECT_QUANTITY: u32 = 10;

impl Effect {
    pub fn is_toggle(&self) -> bool {
        self.unit.is_step()
    }

    pub fn is_trigger(&self) -> bool {
        !self.unit.is_step()
    }

    pub fn signed_steps(&self) -> i32 {
        if !self.unit.is_step() {
            return 0;
        }
        match self.operation {
            EffectOperation::Add | EffectOperation::Advance => self.quantity as i32,
            EffectOperation::Subtract => -(self.quantity as i32),
        }
    }

    pub fn matches(&self, attribute: Attribute, skill_id: Option<&str>) -> bool {
        match self.target.as_deref() {
            None => true,
            Some(target) => {
                let target = target.trim();
                target.eq_ignore_ascii_case(attribute.key())
                    || skill_id.is_some_and(|skill| target.eq_ignore_ascii_case(skill))
            }
        }
    }

    pub fn targets_skill(&self, skill_id: Option<&str>) -> bool {
        match (self.target.as_deref(), skill_id) {
            (Some(target), Some(skill)) => target.trim().eq_ignore_ascii_case(skill),
            _ => false,
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.quantity == 0 {
            return Err("Effect quantity must be at least 1.".into());
        }
        if self.quantity > MAX_EFFECT_QUANTITY {
            return Err(format!(
                "Effect quantity {} exceeds the maximum of {}.",
                self.quantity, MAX_EFFECT_QUANTITY
            ));
        }
        if matches!(self.operation, EffectOperation::Advance) && !self.unit.is_step() {
            return Err(
                "The 'advance' operation is only valid together with 'unit: step'.".into(),
            );
        }
        Ok(())
    }

    pub fn describe(&self) -> String {
        let verb = match (self.operation, self.unit) {
            (EffectOperation::Add, EffectUnit::Step) | (EffectOperation::Advance, _) => "Avança",
            (EffectOperation::Add, EffectUnit::Die(_)) => "Adiciona",
            (EffectOperation::Subtract, EffectUnit::Step) => "Reduz",
            (EffectOperation::Subtract, EffectUnit::Die(_)) => "Remove",
        };
        let unit = match self.unit {
            EffectUnit::Step => {
                if self.quantity == 1 {
                    "passo".to_string()
                } else {
                    "passos".to_string()
                }
            }
            EffectUnit::Die(die) => die.notation(),
        };
        match &self.target {
            Some(target) => format!("{} {} {} em {}", verb, self.quantity, unit, target),
            None => format!("{} {} {}", verb, self.quantity, unit),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryBehavior {
    Informational,
    Toggle,
    Trigger,
    Mixed,
}

pub fn classify(effects: &[Effect]) -> EntryBehavior {
    let has_toggle = effects.iter().any(Effect::is_toggle);
    let has_trigger = effects.iter().any(Effect::is_trigger);
    match (has_toggle, has_trigger) {
        (false, false) => EntryBehavior::Informational,
        (true, false) => EntryBehavior::Toggle,
        (false, true) => EntryBehavior::Trigger,
        (true, true) => EntryBehavior::Mixed,
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TestRequest {
    #[serde(default)]
    pub attribute: Option<Attribute>,
    #[serde(default)]
    pub skill_id: Option<String>,
    #[serde(default)]
    pub triggered: Vec<String>,
    #[serde(default)]
    pub help: Option<u32>,
    #[serde(default)]
    pub extra_dice: Vec<StepDice>,
    #[serde(default)]
    pub secret: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedDie {
    pub sides: u8,
    pub source: String,
    pub base: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedPool {
    pub dice: Vec<ResolvedDie>,
    pub excluded: Vec<ResolvedDie>,
    pub applied: Vec<String>,
    pub ignored: Vec<String>,
    pub label: String,
    pub secret: bool,
}

impl ResolvedPool {
    pub fn to_pool_entries(&self) -> Vec<PoolEntry> {
        self.dice
            .iter()
            .map(|die| {
                PoolEntry::new(
                    crate::dice::Die::new(die.sides).unwrap_or_else(|_| StepDice::D4.into()),
                    die.source.clone(),
                )
            })
            .collect()
    }
}

pub fn resolve_test(sheet: &CharacterSheet, request: &TestRequest) -> Result<ResolvedPool, String> {
    let skill = match request.skill_id.as_deref() {
        Some(id) => Some(
            sheet
                .skill(id)
                .ok_or_else(|| format!("Unknown skill id: {}", id))?,
        ),
        None => None,
    };

    let attribute = match (request.attribute, skill) {
        (Some(attribute), Some(skill)) if attribute != skill.governed_by => {
            return Err(format!(
                "Skill '{}' is governed by '{}', not '{}'.",
                skill.id,
                skill.governed_by.key(),
                attribute.key()
            ));
        }
        (Some(attribute), _) => attribute,
        (None, Some(skill)) => skill.governed_by,
        (None, None) => {
            return Err("A test requires an attribute, a skill, or both.".into());
        }
    };

    let skill_id = skill.map(|s| s.id.as_str());

    let mut attribute_steps = 0i32;
    let mut skill_steps = 0i32;
    let mut bonus: Vec<ResolvedDie> = Vec::new();
    let mut applied: Vec<String> = Vec::new();
    let mut ignored: Vec<String> = Vec::new();

    // --- Standing (toggle) effects -----------------------------------------
    for source in sheet.standing_effects() {
        for effect in source.effects {
            if !effect.is_toggle() {
                continue;
            }
            if !effect.matches(attribute, skill_id) {
                continue;
            }
            if effect.targets_skill(skill_id) {
                skill_steps += effect.signed_steps();
            } else {
                attribute_steps += effect.signed_steps();
            }
            applied.push(format!("{}: {}", source.name, effect.describe()));
        }
    }

    // --- Built-in "Ajuda" ---------------------------------------------------
    if let Some(help) = request.help {
        if !(1..=2).contains(&help) {
            return Err("Ajuda must grant either 1 or 2 steps.".into());
        }
        attribute_steps += help as i32;
        applied.push(format!(
            "Ajuda: Avança {} {}",
            help,
            if help == 1 { "passo" } else { "passos" }
        ));
    }

    // --- Triggered (die) effects -------------------------------------------
    for entry_id in &request.triggered {
        let entry = sheet
            .entry(entry_id)
            .ok_or_else(|| format!("Unknown ability or inventory id: {}", entry_id))?;
        let mut used = false;
        for effect in &entry.effects {
            if !effect.is_trigger() {
                continue;
            }
            if !effect.matches(attribute, skill_id) {
                ignored.push(format!(
                    "{}: {} (não se aplica a este teste)",
                    entry.name,
                    effect.describe()
                ));
                continue;
            }
            let EffectUnit::Die(die) = effect.unit else {
                continue;
            };
            match effect.operation {
                EffectOperation::Add => {
                    for _ in 0..effect.quantity {
                        bonus.push(ResolvedDie {
                            sides: die.sides(),
                            source: entry.name.clone(),
                            base: false,
                        });
                    }
                    used = true;
                }
                EffectOperation::Subtract => {
                    let mut removed = 0;
                    for _ in 0..effect.quantity {
                        if let Some(position) =
                            bonus.iter().rposition(|d| d.sides == die.sides())
                        {
                            bonus.remove(position);
                            removed += 1;
                        }
                    }
                    if removed == 0 {
                        ignored.push(format!(
                            "{}: {} (nenhum dado correspondente no teste)",
                            entry.name,
                            effect.describe()
                        ));
                        continue;
                    }
                    used = true;
                }
                EffectOperation::Advance => {
                    ignored.push(format!(
                        "{}: operação 'advance' exige 'unit: step'",
                        entry.name
                    ));
                    continue;
                }
            }
            applied.push(format!("{}: {}", entry.name, effect.describe()));
        }
        if !used && !entry.effects.iter().any(Effect::is_trigger) {
            ignored.push(format!("{}: entrada sem efeito de dado", entry.name));
        }
    }

    for &die in &request.extra_dice {
        bonus.push(ResolvedDie {
            sides: die.sides(),
            source: "Bônus".to_string(),
            base: false,
        });
    }

    // --- Base dice ----------------------------------------------------------
    let attribute_die = sheet.attributes.get(attribute).apply_steps(attribute_steps);
    let mut dice = vec![ResolvedDie {
        sides: attribute_die.sides(),
        source: attribute.display_pt().to_string(),
        base: true,
    }];
    if let Some(skill) = skill {
        let skill_die = skill.value.apply_steps(skill_steps);
        dice.push(ResolvedDie {
            sides: skill_die.sides(),
            source: skill.name.clone(),
            base: true,
        });
    }

    // --- Cap the pool at four dice -----------------------------------------
    bonus.sort_by(|a, b| b.sides.cmp(&a.sides));
    let room = MAX_POOL_SIZE.saturating_sub(dice.len());
    let excluded: Vec<ResolvedDie> = bonus.split_off(room.min(bonus.len()));
    dice.extend(bonus);
    for die in &excluded {
        ignored.push(format!(
            "{}: d{} excedeu o limite de {} dados",
            die.source, die.sides, MAX_POOL_SIZE
        ));
    }

    let label = match skill {
        Some(skill) => format!("Teste de {} ({})", attribute.display_pt(), skill.name),
        None => format!("Teste de {}", attribute.display_pt()),
    };

    Ok(ResolvedPool {
        dice,
        excluded,
        applied,
        ignored,
        label,
        secret: request.secret,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Entry;
    use crate::rules;

    fn effect(op: EffectOperation, quantity: u32, unit: EffectUnit, target: Option<&str>) -> Effect {
        Effect {
            operation: op,
            quantity,
            unit,
            target: target.map(str::to_string),
        }
    }

    fn sheet() -> CharacterSheet {
        let mut sheet = CharacterSheet::new("Elian Thorne", "Combatente", "Mercenário");
        sheet.attributes.physical = StepDice::D8;
        sheet.attributes.mind = StepDice::D6;
        sheet.attributes.emotion = StepDice::D4;
        sheet.set_skill_value("furtividade", StepDice::D6).unwrap();
        sheet
    }

    fn request(skill: &str) -> TestRequest {
        TestRequest {
            skill_id: Some(skill.to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn unit_round_trips_through_yaml() {
        let yaml = "operation: add\nquantity: 1\nunit: 4\ntarget: furtividade\n";
        let parsed: Effect = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(parsed.unit, EffectUnit::Die(StepDice::D4));
        let back = serde_yaml::to_string(&parsed).unwrap();
        assert!(back.contains("unit: 4"), "{back}");

        let stepped: Effect =
            serde_yaml::from_str("operation: advance\nquantity: 1\nunit: step\n").unwrap();
        assert_eq!(stepped.unit, EffectUnit::Step);
        assert!(serde_yaml::to_string(&stepped).unwrap().contains("unit: step"));
    }

    #[test]
    fn entries_are_classified_by_their_units() {
        assert_eq!(classify(&[]), EntryBehavior::Informational);
        assert_eq!(
            classify(&[effect(EffectOperation::Advance, 1, EffectUnit::Step, None)]),
            EntryBehavior::Toggle
        );
        assert_eq!(
            classify(&[effect(
                EffectOperation::Add,
                1,
                EffectUnit::Die(StepDice::D6),
                None
            )]),
            EntryBehavior::Trigger
        );
        assert_eq!(
            classify(&[
                effect(EffectOperation::Advance, 1, EffectUnit::Step, None),
                effect(EffectOperation::Add, 1, EffectUnit::Die(StepDice::D6), None),
            ]),
            EntryBehavior::Mixed
        );
    }

    #[test]
    fn a_plain_test_rolls_attribute_plus_skill() {
        let sheet = sheet();
        let pool = resolve_test(&sheet, &request("furtividade")).unwrap();
        assert_eq!(pool.dice.len(), 2);
        assert_eq!(pool.dice[0].sides, 8);
        assert_eq!(pool.dice[0].source, "Físico");
        assert_eq!(pool.dice[1].sides, 6);
        assert_eq!(pool.dice[1].source, "Furtividade");
        assert_eq!(pool.label, "Teste de Físico (Furtividade)");
    }

    #[test]
    fn selecting_only_an_attribute_rolls_a_single_die() {
        let sheet = sheet();
        let pool = resolve_test(
            &sheet,
            &TestRequest {
                attribute: Some(Attribute::Mind),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(pool.dice.len(), 1);
        assert_eq!(pool.dice[0].sides, 6);
        assert_eq!(pool.label, "Teste de Mente");
    }

    #[test]
    fn a_skill_implies_its_governing_attribute() {
        let sheet = sheet();
        let pool = resolve_test(&sheet, &request("medicina")).unwrap();
        assert_eq!(pool.dice[0].source, "Mente");
    }

    #[test]
    fn mismatched_attribute_and_skill_are_rejected() {
        let sheet = sheet();
        let error = resolve_test(
            &sheet,
            &TestRequest {
                attribute: Some(Attribute::Emotion),
                skill_id: Some("furtividade".into()),
                ..Default::default()
            },
        )
        .unwrap_err();
        assert!(error.contains("governed by"), "{error}");
    }

    #[test]
    fn active_step_effects_shift_the_attribute_die() {
        let mut sheet = sheet();
        sheet.active_effects.push(rules::builtin("machucado", None).unwrap());
        let pool = resolve_test(&sheet, &request("furtividade")).unwrap();
        assert_eq!(pool.dice[0].sides, 6);
        assert_eq!(pool.dice[1].sides, 6);
        assert!(pool.applied.iter().any(|a| a.contains("Machucado")));
    }

    #[test]
    fn debuffs_only_touch_the_attribute_they_target() {
        let mut sheet = sheet();
        sheet.active_effects.push(rules::builtin("desatencao", None).unwrap());
        let pool = resolve_test(&sheet, &request("furtividade")).unwrap();
        assert_eq!(pool.dice[0].sides, 8, "Físico must be untouched by Desatenção");
    }

    #[test]
    fn step_effects_targeting_a_skill_shift_the_skill_die() {
        let mut sheet = sheet();
        sheet.abilities.push(Entry {
            id: "treinado".into(),
            name: "Treinado".into(),
            description: String::new(),
            active: true,
            effects: vec![effect(
                EffectOperation::Advance,
                2,
                EffectUnit::Step,
                Some("furtividade"),
            )],
        });
        let pool = resolve_test(&sheet, &request("furtividade")).unwrap();
        assert_eq!(pool.dice[0].sides, 8, "attribute die unchanged");
        assert_eq!(pool.dice[1].sides, 10, "d6 +2 steps -> d10");
    }

    #[test]
    fn inactive_entries_contribute_nothing() {
        let mut sheet = sheet();
        sheet.abilities.push(Entry {
            id: "treinado".into(),
            name: "Treinado".into(),
            description: String::new(),
            active: false,
            effects: vec![effect(EffectOperation::Advance, 2, EffectUnit::Step, None)],
        });
        let pool = resolve_test(&sheet, &request("furtividade")).unwrap();
        assert_eq!(pool.dice[0].sides, 8);
        assert!(pool.applied.is_empty());
    }

    #[test]
    fn step_changes_clamp_at_the_ladder_bounds() {
        let mut sheet = sheet();
        sheet.attributes.physical = StepDice::D12;
        sheet.abilities.push(Entry {
            id: "sobrecarga".into(),
            name: "Sobrecarga".into(),
            description: String::new(),
            active: true,
            effects: vec![effect(EffectOperation::Add, 4, EffectUnit::Step, None)],
        });
        let pool = resolve_test(&sheet, &request("furtividade")).unwrap();
        assert_eq!(pool.dice[0].sides, 12);
    }

    #[test]
    fn triggered_die_effects_add_bonus_dice() {
        let mut sheet = sheet();
        sheet.abilities.push(Entry {
            id: "reflexos".into(),
            name: "Reflexos".into(),
            description: "Adiciona um dado em esquivas.".into(),
            active: true,
            effects: vec![effect(
                EffectOperation::Add,
                1,
                EffectUnit::Die(StepDice::D4),
                Some("furtividade"),
            )],
        });
        let mut req = request("furtividade");
        req.triggered = vec!["reflexos".into()];
        let pool = resolve_test(&sheet, &req).unwrap();
        assert_eq!(pool.dice.len(), 3);
        assert_eq!(pool.dice[2].sides, 4);
        assert_eq!(pool.dice[2].source, "Reflexos");
        assert!(!pool.dice[2].base);
    }

    #[test]
    fn triggered_effects_are_ignored_when_they_target_another_skill() {
        let mut sheet = sheet();
        sheet.abilities.push(Entry {
            id: "reflexos".into(),
            name: "Reflexos".into(),
            description: String::new(),
            active: true,
            effects: vec![effect(
                EffectOperation::Add,
                1,
                EffectUnit::Die(StepDice::D4),
                Some("furtividade"),
            )],
        });
        let mut req = request("luta");
        req.triggered = vec!["reflexos".into()];
        let pool = resolve_test(&sheet, &req).unwrap();
        assert_eq!(pool.dice.len(), 2);
        assert_eq!(pool.ignored.len(), 1);
    }

    #[test]
    fn the_pool_never_exceeds_four_dice() {
        let mut sheet = sheet();
        sheet.abilities.push(Entry {
            id: "tempestade".into(),
            name: "Tempestade".into(),
            description: String::new(),
            active: true,
            effects: vec![effect(
                EffectOperation::Add,
                4,
                EffectUnit::Die(StepDice::D6),
                None,
            )],
        });
        let mut req = request("furtividade");
        req.triggered = vec!["tempestade".into()];
        let pool = resolve_test(&sheet, &req).unwrap();
        assert_eq!(pool.dice.len(), MAX_POOL_SIZE);
        assert_eq!(pool.excluded.len(), 2);
        assert!(pool.dice[0].base && pool.dice[1].base);
    }

    #[test]
    fn surplus_trimming_keeps_the_largest_bonus_dice() {
        let mut sheet = sheet();
        sheet.abilities.push(Entry {
            id: "misto".into(),
            name: "Misto".into(),
            description: String::new(),
            active: true,
            effects: vec![
                effect(EffectOperation::Add, 1, EffectUnit::Die(StepDice::D4), None),
                effect(EffectOperation::Add, 1, EffectUnit::Die(StepDice::D12), None),
                effect(EffectOperation::Add, 1, EffectUnit::Die(StepDice::D8), None),
            ],
        });
        let mut req = request("furtividade");
        req.triggered = vec!["misto".into()];
        let pool = resolve_test(&sheet, &req).unwrap();
        assert_eq!(pool.dice[2].sides, 12);
        assert_eq!(pool.dice[3].sides, 8);
        assert_eq!(pool.excluded[0].sides, 4);
    }

    #[test]
    fn ajuda_adds_one_or_two_steps_to_the_test() {
        let sheet = sheet();
        let mut req = request("furtividade");
        req.help = Some(2);
        let pool = resolve_test(&sheet, &req).unwrap();
        assert_eq!(pool.dice[0].sides, 12, "d8 +2 steps -> d12");

        req.help = Some(3);
        assert!(resolve_test(&sheet, &req).is_err());
    }

    #[test]
    fn unknown_ids_are_rejected_rather_than_silently_dropped() {
        let sheet = sheet();
        assert!(resolve_test(&sheet, &request("inexistente")).is_err());
        let mut req = request("furtividade");
        req.triggered = vec!["fantasma".into()];
        assert!(resolve_test(&sheet, &req).is_err());
    }

    #[test]
    fn effect_validation_rejects_impossible_combinations() {
        assert!(effect(EffectOperation::Add, 0, EffectUnit::Step, None)
            .validate()
            .is_err());
        assert!(
            effect(EffectOperation::Advance, 1, EffectUnit::Die(StepDice::D6), None)
                .validate()
                .is_err()
        );
        assert!(effect(EffectOperation::Add, 2, EffectUnit::Die(StepDice::D6), None)
            .validate()
            .is_ok());
    }

    #[test]
    fn descriptions_are_written_in_portuguese() {
        let described = effect(
            EffectOperation::Add,
            2,
            EffectUnit::Die(StepDice::D6),
            None,
        )
        .describe();
        assert_eq!(described, "Adiciona 2 d6");
        let described = effect(EffectOperation::Advance, 1, EffectUnit::Step, None).describe();
        assert_eq!(described, "Avança 1 passo");
    }

    #[test]
    fn skills_and_attributes_never_leave_the_pool_when_trimming() {
        let mut sheet = sheet();
        for index in 0..3 {
            sheet.abilities.push(Entry {
                id: format!("extra{index}"),
                name: format!("Extra {index}"),
                description: String::new(),
                active: true,
                effects: vec![effect(
                    EffectOperation::Add,
                    1,
                    EffectUnit::Die(StepDice::D12),
                    None,
                )],
            });
        }
        let mut req = request("furtividade");
        req.triggered = vec!["extra0".into(), "extra1".into(), "extra2".into()];
        let pool = resolve_test(&sheet, &req).unwrap();
        assert_eq!(pool.dice.iter().filter(|d| d.base).count(), 2);
        assert_eq!(pool.dice.len(), 4);
    }

    #[test]
    fn a_subtract_die_effect_removes_a_bonus_die() {
        let mut sheet = sheet();
        sheet.abilities.push(Entry {
            id: "bonus".into(),
            name: "Bônus".into(),
            description: String::new(),
            active: true,
            effects: vec![effect(
                EffectOperation::Add,
                2,
                EffectUnit::Die(StepDice::D6),
                None,
            )],
        });
        sheet.inventory.push(Entry {
            id: "penalidade".into(),
            name: "Penalidade".into(),
            description: String::new(),
            active: true,
            effects: vec![effect(
                EffectOperation::Subtract,
                1,
                EffectUnit::Die(StepDice::D6),
                None,
            )],
        });
        let mut req = request("furtividade");
        req.triggered = vec!["bonus".into(), "penalidade".into()];
        let pool = resolve_test(&sheet, &req).unwrap();
        assert_eq!(pool.dice.len(), 3);
    }

    #[test]
    fn skill_defaults_are_available_for_every_attribute() {
        let sheet = sheet();
        for definition in rules::DEFAULT_SKILLS {
            let resolved = resolve_test(&sheet, &request(definition.id)).unwrap();
            assert_eq!(resolved.dice.len(), 2, "failed for {}", definition.id);
        }
    }
}
