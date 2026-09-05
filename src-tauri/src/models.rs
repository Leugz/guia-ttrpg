use serde::{Deserialize, Serialize};

use crate::dice::StepDice;
use crate::effects::Effect;
use crate::rules;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Attribute {
    Physical,
    Mind,
    Emotion,
}

impl Attribute {
    pub const ALL: [Attribute; 3] = [Attribute::Physical, Attribute::Mind, Attribute::Emotion];

    pub fn key(self) -> &'static str {
        match self {
            Attribute::Physical => "physical",
            Attribute::Mind => "mind",
            Attribute::Emotion => "emotion",
        }
    }

    pub fn display_pt(self) -> &'static str {
        match self {
            Attribute::Physical => "Físico",
            Attribute::Mind => "Mente",
            Attribute::Emotion => "Emoção",
        }
    }

    pub fn from_key(key: &str) -> Option<Self> {
        match key.trim().to_lowercase().as_str() {
            "physical" => Some(Attribute::Physical),
            "mind" => Some(Attribute::Mind),
            "emotion" => Some(Attribute::Emotion),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Attributes {
    pub physical: StepDice,
    pub mind: StepDice,
    pub emotion: StepDice,
}

impl Default for Attributes {
    fn default() -> Self {
        Attributes {
            physical: StepDice::D4,
            mind: StepDice::D4,
            emotion: StepDice::D4,
        }
    }
}

impl Attributes {
    pub fn get(&self, attribute: Attribute) -> StepDice {
        match attribute {
            Attribute::Physical => self.physical,
            Attribute::Mind => self.mind,
            Attribute::Emotion => self.emotion,
        }
    }

    pub fn set(&mut self, attribute: Attribute, value: StepDice) {
        match attribute {
            Attribute::Physical => self.physical = value,
            Attribute::Mind => self.mind = value,
            Attribute::Emotion => self.emotion = value,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub governed_by: Attribute,
    pub value: StepDice,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub active: bool,
    #[serde(default)]
    pub effects: Vec<Effect>,
}

impl Entry {
    pub fn behavior(&self) -> crate::effects::EntryBehavior {
        crate::effects::classify(&self.effects)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EffectSource {
    Ability,
    Inventory,
    Builtin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveEffect {
    pub id: String,
    pub name: String,
    pub source: EffectSource,
    #[serde(default)]
    pub effects: Vec<Effect>,
}

pub struct StandingEffect<'a> {
    pub id: &'a str,
    pub name: &'a str,
    pub effects: &'a [Effect],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceKind {
    Hp,
    Dp,
}

impl ResourceKind {
    pub fn from_key(key: &str) -> Option<Self> {
        match key.trim().to_lowercase().as_str() {
            "hp" | "pv" => Some(ResourceKind::Hp),
            "dp" | "pd" => Some(ResourceKind::Dp),
            _ => None,
        }
    }

    pub fn display_pt(self) -> &'static str {
        match self {
            ResourceKind::Hp => "PV",
            ResourceKind::Dp => "PD",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ResourceStat {
    pub current: i32,
    pub max: i32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Resources {
    pub hp: ResourceStat,
    pub dp: ResourceStat,
}

impl Resources {
    pub fn get(&self, kind: ResourceKind) -> ResourceStat {
        match kind {
            ResourceKind::Hp => self.hp,
            ResourceKind::Dp => self.dp,
        }
    }

    pub fn get_mut(&mut self, kind: ResourceKind) -> &mut ResourceStat {
        match kind {
            ResourceKind::Hp => &mut self.hp,
            ResourceKind::Dp => &mut self.dp,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SaveState {
    pub dc: i32,
    pub failed: bool,
}

impl Default for SaveState {
    fn default() -> Self {
        SaveState {
            dc: rules::DEATH_SAVE_INITIAL_DC,
            failed: false,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct DeathSaves {
    #[serde(default)]
    pub hp: SaveState,
    #[serde(default)]
    pub dp: SaveState,
}

impl DeathSaves {
    pub fn get(&self, kind: ResourceKind) -> SaveState {
        match kind {
            ResourceKind::Hp => self.hp,
            ResourceKind::Dp => self.dp,
        }
    }

    pub fn get_mut(&mut self, kind: ResourceKind) -> &mut SaveState {
        match kind {
            ResourceKind::Hp => &mut self.hp,
            ResourceKind::Dp => &mut self.dp,
        }
    }
}

fn default_sheet_type() -> String {
    "character".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterSheet {
    #[serde(rename = "type", default = "default_sheet_type")]
    pub sheet_type: String,
    pub name: String,
    #[serde(default)]
    pub profile: String,
    #[serde(default)]
    pub occupation: String,
    #[serde(default = "default_level")]
    pub level: u32,
    pub color: Option<String>,
    pub resources: Resources,
    #[serde(alias = "base_attributes")]
    pub attributes: Attributes,
    #[serde(default)]
    pub skills: Vec<Skill>,
    #[serde(default)]
    pub abilities: Vec<Entry>,
    #[serde(default)]
    pub inventory: Vec<Entry>,
    #[serde(default)]
    pub active_effects: Vec<ActiveEffect>,
    #[serde(default)]
    pub accessible_sheets: Vec<String>,
    #[serde(default)]
    pub death_saves: DeathSaves,
}

fn default_level() -> u32 {
    1
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ResourceChange {
    pub kind: ResourceKind,
    pub previous: i32,
    pub current: i32,
    pub triggered_save: bool,
    pub recovered: bool,
}

impl CharacterSheet {
    pub fn new(name: &str, profile: &str, occupation: &str) -> Self {
        CharacterSheet {
            sheet_type: default_sheet_type(),
            name: name.to_string(),
            profile: profile.to_string(),
            occupation: occupation.to_string(),
            level: 1,
            color: Some("$dc2626".to_string()),
            resources: Resources {
                hp: ResourceStat {
                    current: 10,
                    max: 10,
                },
                dp: ResourceStat { current: 5, max: 5 },
            },
            attributes: Attributes::default(),
            skills: rules::default_skills(),
            abilities: Vec::new(),
            inventory: Vec::new(),
            active_effects: Vec::new(),
            accessible_sheets: Vec::new(),
            death_saves: DeathSaves::default(),
        }
    }

    pub fn skill(&self, id: &str) -> Option<&Skill> {
        self.skills
            .iter()
            .find(|skill| skill.id.eq_ignore_ascii_case(id.trim()))
    }

    pub fn skill_mut(&mut self, id: &str) -> Option<&mut Skill> {
        let id = id.trim().to_string();
        self.skills
            .iter_mut()
            .find(|skill| skill.id.eq_ignore_ascii_case(&id))
    }

    pub fn set_skill_value(&mut self, id: &str, value: StepDice) -> Result<(), String> {
        if let Some(skill) = self.skill_mut(id) {
            skill.value = value;
            return Ok(());
        }
        match rules::skill_definition(id) {
            Some(definition) => {
                let mut skill = definition.to_skill();
                skill.value = value;
                self.skills.push(skill);
                Ok(())
            }
            None => Err(format!("Unknown skill id: {}", id)),
        }
    }

    pub fn entry(&self, id: &str) -> Option<&Entry> {
        let id = id.trim();
        self.abilities
            .iter()
            .chain(self.inventory.iter())
            .find(|entry| entry.id.eq_ignore_ascii_case(id))
    }

    pub fn entry_mut(&mut self, id: &str) -> Option<&mut Entry> {
        let id = id.trim().to_string();
        self.abilities
            .iter_mut()
            .chain(self.inventory.iter_mut())
            .find(|entry| entry.id.eq_ignore_ascii_case(&id))
    }

    pub fn standing_effects(&self) -> Vec<StandingEffect<'_>> {
        let entries = self
            .abilities
            .iter()
            .chain(self.inventory.iter())
            .filter(|entry| entry.active)
            .map(|entry| StandingEffect {
                id: &entry.id,
                name: &entry.name,
                effects: &entry.effects,
            });
        let applied = self.active_effects.iter().map(|effect| StandingEffect {
            id: &effect.id,
            name: &effect.name,
            effects: &effect.effects,
        });
        entries.chain(applied).collect()
    }

    pub fn is_downed(&self, kind: ResourceKind) -> bool {
        self.resources.get(kind).current <= 0
    }

    pub fn apply_resource_delta(&mut self, kind: ResourceKind, delta: i32) -> ResourceChange {
        let stat = self.resources.get_mut(kind);
        let previous = stat.current;
        stat.current = (stat.current + delta).clamp(0, stat.max);
        let current = stat.current;

        let recovered = previous <= 0 && current > 0;
        if recovered {
            *self.death_saves.get_mut(kind) = SaveState::default();
        }

        ResourceChange {
            kind,
            previous,
            current,
            triggered_save: previous > 0 && current <= 0,
            recovered,
        }
    }

    pub fn death_save_test(&self, kind: ResourceKind) -> Result<(&Skill, i32), String> {
        if !self.is_downed(kind) {
            return Err(format!(
                "{} is above zero; no saving throw is required.",
                kind.display_pt()
            ));
        }
        let skill_id = rules::death_save_skill(kind);
        let skill = self
            .skill(skill_id)
            .ok_or_else(|| format!("Sheet is missing the '{}' skill.", skill_id))?;
        Ok((skill, self.death_saves.get(kind).dc))
    }

    pub fn register_death_save(&mut self, kind: ResourceKind, success: bool) -> SaveState {
        let state = self.death_saves.get_mut(kind);
        if success {
            state.dc += rules::DEATH_SAVE_DC_INCREMENT;
        } else {
            state.failed = true;
        }
        *state
    }

    pub fn normalize(&mut self) -> Vec<String> {
        let mut notes = Vec::new();

        if self.sheet_type.trim().is_empty() {
            self.sheet_type = default_sheet_type();
        }
        if self.level == 0 {
            self.level = 1;
            notes.push("Nível inválido ajustado para 1.".to_string());
        }

        for kind in [ResourceKind::Hp, ResourceKind::Dp] {
            let stat = self.resources.get_mut(kind);
            if stat.max < 0 {
                stat.max = 0;
            }
            if stat.current > stat.max {
                stat.current = stat.max;
                notes.push(format!(
                    "{} atual reduzido para o máximo.",
                    kind.display_pt()
                ));
            }
            if stat.current < 0 {
                stat.current = 0;
            }
            let state = self.death_saves.get_mut(kind);
            if state.dc < rules::DEATH_SAVE_INITIAL_DC {
                state.dc = rules::DEATH_SAVE_INITIAL_DC;
            }
        }

        for definition in rules::DEFAULT_SKILLS {
            if self.skill(definition.id).is_none() {
                self.skills.push(definition.to_skill());
                notes.push(format!("Perícia padrão '{}' adicionada.", definition.name));
            }
        }

        for entry in self.abilities.iter_mut().chain(self.inventory.iter_mut()) {
            if entry.id.trim().is_empty() {
                entry.id = slug(&entry.name);
                notes.push(format!("Identificador gerado para '{}'.", entry.name));
            }
            let before = entry.effects.len();
            entry.effects.retain(|effect| match effect.validate() {
                Ok(()) => true,
                Err(reason) => {
                    tracing::warn!(entry = %entry.name, %reason, "dropping invalid effect");
                    false
                }
            });
            if entry.effects.len() != before {
                notes.push(format!("Efeito inválido removido de '{}'.", entry.name));
            }
        }

        self.active_effects.retain(|active| {
            let valid = active.effects.iter().all(|e| e.validate().is_ok());
            if !valid {
                tracing::warn!(effect = %active.name, "dropping invalid active effect");
            }
            valid
        });

        notes
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Character name cannot be empty.".into());
        }
        if self.level == 0 || self.level > 99 {
            return Err(format!(
                "Invalid level: {}. Must be between 1 and 99.",
                self.level
            ));
        }

        for kind in [ResourceKind::Hp, ResourceKind::Dp] {
            let stat = self.resources.get(kind);
            if stat.max < 0 {
                return Err(format!("Max {} cannot be negative.", kind.display_pt()));
            }
            if stat.current < 0 {
                return Err(format!("Current {} cannot be negative.", kind.display_pt()));
            }
            if stat.current > stat.max {
                return Err(format!(
                    "Current {} cannot exceed Max {}.",
                    kind.display_pt(),
                    kind.display_pt()
                ));
            }
            if self.death_saves.get(kind).dc < rules::DEATH_SAVE_INITIAL_DC {
                return Err(format!(
                    "Saving throw DC for {} cannot be below {}.",
                    kind.display_pt(),
                    rules::DEATH_SAVE_INITIAL_DC
                ));
            }
        }

        let mut seen_skills = Vec::new();
        for skill in &self.skills {
            if skill.id.trim().is_empty() {
                return Err("Every skill needs a stable id.".into());
            }
            if skill.name.trim().is_empty() {
                return Err(format!("Skill '{}' needs a display name.", skill.id));
            }
            let key = skill.id.to_lowercase();
            if seen_skills.contains(&key) {
                return Err(format!("Duplicate skill id: {}", skill.id));
            }
            if let Some(parent) = &skill.parent {
                if !self
                    .skills
                    .iter()
                    .any(|s| s.id.eq_ignore_ascii_case(parent))
                {
                    return Err(format!(
                        "Skill '{}' references unknown parent '{}'.",
                        skill.id, parent
                    ));
                }
            }
            seen_skills.push(key);
        }

        let mut seen_entries = Vec::new();
        for entry in self.abilities.iter().chain(self.inventory.iter()) {
            if entry.id.trim().is_empty() {
                return Err(format!("Entry '{}' needs a stable id.", entry.name));
            }
            if entry.name.trim().is_empty() {
                return Err("Every ability or inventory entry needs a name.".into());
            }
            let key = entry.id.to_lowercase();
            if seen_entries.contains(&key) {
                return Err(format!("Duplicate ability/inventory id: {}", entry.id));
            }
            seen_entries.push(key);
            for effect in &entry.effects {
                effect
                    .validate()
                    .map_err(|reason| format!("{}: {}", entry.name, reason))?;
            }
            self.validate_targets(&entry.effects, &entry.name)?;
        }

        for active in &self.active_effects {
            for effect in &active.effects {
                effect
                    .validate()
                    .map_err(|reason| format!("{}: {}", active.name, reason))?;
            }
        }

        for reference in &self.accessible_sheets {
            if reference.contains("..")
                || reference.starts_with('/')
                || reference.starts_with('\\')
                || reference.contains(':')
            {
                return Err(format!("Invalid sheet reference: {}", reference));
            }
        }

        Ok(())
    }

    fn validate_targets(&self, effects: &[Effect], owner: &str) -> Result<(), String> {
        for effect in effects {
            let Some(target) = effect.target.as_deref() else {
                continue;
            };
            let target = target.trim();
            let known = Attribute::from_key(target).is_some() || self.skill(target).is_some();
            if !known {
                return Err(format!(
                    "{}: effect targets unknown attribute or skill '{}'.",
                    owner, target
                ));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDocument {
    pub data: CharacterSheet,
    pub body: String,
    #[serde(default)]
    pub notes: Vec<String>,
}

pub fn slug(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut last_was_separator = false;
    for character in input.trim().to_lowercase().chars() {
        let folded = match character {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            other => other,
        };
        if folded.is_ascii_alphanumeric() {
            out.push(folded);
            last_was_separator = false;
        } else if !last_was_separator && !out.is_empty() {
            out.push('_');
            last_was_separator = true;
        }
    }
    while out.ends_with('_') {
        out.pop();
    }
    if out.is_empty() {
        out.push_str("entrada");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::effects::{EffectOperation, EffectUnit};

    const LEGACY_SHEET: &str = r#"
type: character
name: Elian Thorne
profile: Combatente
occupation: Mercenário
level: 1
resources:
  hp:
    current: 18
    max: 20
  dp:
    current: 9
    max: 10
base_attributes:
  physical: D8
  mind: D6
  emotion: D4
abilities:
- name: Ataque Especial
  description: Adiciona +1d8 ao dano
  active: false
"#;

    const CANONICAL_SHEET: &str = r#"
type: character
name: "John Doe"
profile: "Combatente"
occupation: "Policial"
level: 5
resources:
  hp: { current: 15, max: 20 }
  dp: { current: 5, max: 10 }
attributes:
  physical: 8
  mind: 4
  emotion: 6
skills:
  - id: crime
    name: "Crime"
    governed_by: physical
    value: 8
  - id: medicina
    name: "Medicina"
    governed_by: mind
    value: 4
abilities:
  - id: reflexos
    name: "Reflexos"
    description: "Adiciona um dado em esquivas."
    active: true
    effects:
      - operation: add
        quantity: 1
        unit: 4
        target: furtividade
inventory: []
active_effects: []
accessible_sheets: []
"#;

    #[test]
    fn the_spec_schema_parses_exactly_as_written() {
        let mut sheet: CharacterSheet = serde_yaml::from_str(CANONICAL_SHEET).unwrap();
        assert_eq!(sheet.name, "John Doe");
        assert_eq!(sheet.attributes.physical, StepDice::D8);
        assert_eq!(sheet.skill("crime").unwrap().value, StepDice::D8);
        assert_eq!(
            sheet.skill("medicina").unwrap().governed_by,
            Attribute::Mind
        );
        let ability = sheet.entry("reflexos").unwrap();
        assert_eq!(ability.effects[0].unit, EffectUnit::Die(StepDice::D4));
        assert_eq!(ability.effects[0].operation, EffectOperation::Add);
        sheet.normalize();
        sheet.validate().unwrap();
    }

    #[test]
    fn legacy_sheets_still_load_and_are_upgraded() {
        let mut sheet: CharacterSheet = serde_yaml::from_str(LEGACY_SHEET).unwrap();
        assert_eq!(sheet.attributes.physical, StepDice::D8);
        let notes = sheet.normalize();
        assert!(!notes.is_empty());
        assert_eq!(
            sheet.entry("ataque_especial").unwrap().name,
            "Ataque Especial"
        );
        sheet.validate().unwrap();
    }

    #[test]
    fn attributes_are_written_back_as_integers() {
        let sheet: CharacterSheet = serde_yaml::from_str(LEGACY_SHEET).unwrap();
        let yaml = serde_yaml::to_string(&sheet).unwrap();
        assert!(yaml.contains("physical: 8"), "{yaml}");
        assert!(!yaml.contains("D8"), "{yaml}");
        assert!(yaml.contains("type: character"), "{yaml}");
    }

    #[test]
    fn normalization_seeds_the_default_skill_catalog() {
        let mut sheet: CharacterSheet = serde_yaml::from_str(LEGACY_SHEET).unwrap();
        assert!(sheet.skills.is_empty());
        sheet.normalize();
        assert_eq!(sheet.skills.len(), rules::DEFAULT_SKILLS.len());
        assert_eq!(
            sheet.skill("vigor").unwrap().governed_by,
            Attribute::Physical
        );
        assert_eq!(
            sheet.skill("disciplina").unwrap().governed_by,
            Attribute::Emotion
        );
        let mut sheet: CharacterSheet = serde_yaml::from_str(CANONICAL_SHEET).unwrap();
        sheet.normalize();
        assert_eq!(sheet.skill("crime").unwrap().value, StepDice::D8);
    }

    #[test]
    fn aptidao_specializations_reference_their_parent() {
        let sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        let artes = sheet.skill("artes").unwrap();
        assert_eq!(artes.parent.as_deref(), Some("aptidao"));
        assert_eq!(artes.governed_by, Attribute::Mind);
        sheet.validate().unwrap();
    }

    #[test]
    fn validation_rejects_broken_documents() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        sheet.level = 0;
        assert!(sheet.validate().is_err());

        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        sheet.resources.hp.current = 999;
        assert!(sheet.validate().is_err());

        let mut sheet = CharacterSheet::new("", "Combatente", "Policial");
        sheet.name = "  ".into();
        assert!(sheet.validate().is_err());
    }

    #[test]
    fn duplicate_ids_are_rejected() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        for _ in 0..2 {
            sheet.abilities.push(Entry {
                id: "reflexos".into(),
                name: "Reflexos".into(),
                description: String::new(),
                active: false,
                effects: vec![],
            });
        }
        assert!(sheet.validate().is_err());
    }

    #[test]
    fn effects_targeting_unknown_keys_are_rejected() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        sheet.abilities.push(Entry {
            id: "estranho".into(),
            name: "Estranho".into(),
            description: String::new(),
            active: false,
            effects: vec![Effect {
                operation: EffectOperation::Add,
                quantity: 1,
                unit: EffectUnit::Die(StepDice::D6),
                target: Some("nao_existe".into()),
            }],
        });
        assert!(sheet.validate().is_err());
    }

    #[test]
    fn accessible_sheets_cannot_escape_the_campaign_directory() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        sheet.accessible_sheets = vec!["../../etc/passwd".into()];
        assert!(sheet.validate().is_err());
        sheet.accessible_sheets = vec!["personagens/joao.md".into()];
        assert!(sheet.validate().is_ok());
    }

    #[test]
    fn damage_clamps_at_zero_and_flags_the_saving_throw() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        let change = sheet.apply_resource_delta(ResourceKind::Hp, -100);
        assert_eq!(change.current, 0);
        assert!(change.triggered_save);
        assert!(sheet.is_downed(ResourceKind::Hp));
        let change = sheet.apply_resource_delta(ResourceKind::Hp, -1);
        assert!(!change.triggered_save);
    }

    #[test]
    fn healing_never_exceeds_the_maximum() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        let change = sheet.apply_resource_delta(ResourceKind::Hp, 100);
        assert_eq!(change.current, sheet.resources.hp.max);
    }

    #[test]
    fn the_saving_throw_dc_climbs_by_three_and_resets_on_healing() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        sheet.apply_resource_delta(ResourceKind::Hp, -100);
        assert_eq!(sheet.death_saves.hp.dc, 7);
        assert_eq!(sheet.register_death_save(ResourceKind::Hp, true).dc, 10);
        assert_eq!(sheet.register_death_save(ResourceKind::Hp, true).dc, 13);
        assert_eq!(sheet.register_death_save(ResourceKind::Hp, true).dc, 16);

        let state = sheet.register_death_save(ResourceKind::Hp, false);
        assert!(state.failed);

        let change = sheet.apply_resource_delta(ResourceKind::Hp, 3);
        assert!(change.recovered);
        assert_eq!(sheet.death_saves.hp.dc, 7);
        assert!(!sheet.death_saves.hp.failed);
    }

    #[test]
    fn the_two_resources_track_their_saves_independently() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        sheet.apply_resource_delta(ResourceKind::Hp, -100);
        sheet.apply_resource_delta(ResourceKind::Dp, -100);
        sheet.register_death_save(ResourceKind::Hp, true);
        assert_eq!(sheet.death_saves.hp.dc, 10);
        assert_eq!(sheet.death_saves.dp.dc, 7);

        sheet.apply_resource_delta(ResourceKind::Hp, 5);
        assert_eq!(sheet.death_saves.hp.dc, 7);
        assert_eq!(
            sheet.death_saves.dp.dc, 7,
            "PD save is unaffected by PV healing"
        );
    }

    #[test]
    fn saving_throws_use_vigor_and_disciplina() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        assert!(sheet.death_save_test(ResourceKind::Hp).is_err());

        sheet.apply_resource_delta(ResourceKind::Hp, -100);
        let (skill, dc) = sheet.death_save_test(ResourceKind::Hp).unwrap();
        assert_eq!(skill.id, "vigor");
        assert_eq!(dc, 7);

        sheet.apply_resource_delta(ResourceKind::Dp, -100);
        let (skill, _) = sheet.death_save_test(ResourceKind::Dp).unwrap();
        assert_eq!(skill.id, "disciplina");
    }

    #[test]
    fn slugs_fold_portuguese_accents() {
        assert_eq!(slug("Ataque Especial"), "ataque_especial");
        assert_eq!(slug("Percepção"), "percepcao");
        assert_eq!(slug("Aptidão: Tática"), "aptidao_tatica");
        assert_eq!(slug("   "), "entrada");
    }

    #[test]
    fn setting_an_unknown_skill_is_an_error() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        assert!(sheet.set_skill_value("furtividade", StepDice::D10).is_ok());
        assert_eq!(sheet.skill("furtividade").unwrap().value, StepDice::D10);
        assert!(sheet.set_skill_value("inexistente", StepDice::D6).is_err());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Handout {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub category: String,
    #[serde(default = "default_content_type")]
    pub content_type: String,
    #[serde(default)]
    pub is_public: bool,
    #[serde(default)]
    pub shared_with: Vec<String>,
    #[serde(default)]
    pub content: String,
}

pub fn default_content_type() -> String {
    "text".to_string()
}
