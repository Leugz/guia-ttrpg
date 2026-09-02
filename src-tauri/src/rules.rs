use serde::Serialize;

use crate::dice::StepDice;
use crate::effects::{Effect, EffectOperation, EffectUnit};
use crate::models::{ActiveEffect, Attribute, EffectSource, ResourceKind, Skill};

pub const DEATH_SAVE_INITIAL_DC: i32 = 7;
pub const DEATH_SAVE_DC_INCREMENT: i32 = 3;
pub const UNTRAINED_SKILL_DIE: StepDice = StepDice::D4;
pub const HP_SAVE_SKILL: &str = "vigor";
pub const DP_SAVE_SKILL: &str = "disciplina";

pub fn death_save_skill(kind: ResourceKind) -> &'static str {
    match kind {
        ResourceKind::Hp => HP_SAVE_SKILL,
        ResourceKind::Dp => DP_SAVE_SKILL,
    }
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct SkillDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub governed_by: Attribute,
    pub parent: Option<&'static str>,
}

impl SkillDefinition {
    pub fn to_skill(self) -> Skill {
        Skill {
            id: self.id.to_string(),
            name: self.name.to_string(),
            governed_by: self.governed_by,
            value: UNTRAINED_SKILL_DIE,
            parent: self.parent.map(str::to_string),
        }
    }
}

const fn skill(
    id: &'static str,
    name: &'static str,
    governed_by: Attribute,
) -> SkillDefinition {
    SkillDefinition {
        id,
        name,
        governed_by,
        parent: None,
    }
}

const fn specialization(
    id: &'static str,
    name: &'static str,
    parent: &'static str,
) -> SkillDefinition {
    SkillDefinition {
        id,
        name,
        governed_by: Attribute::Mind,
        parent: Some(parent),
    }
}

pub const DEFAULT_SKILLS: &[SkillDefinition] = &[
    // Físico
    skill("acrobacia", "Acrobacia", Attribute::Physical),
    skill("atletismo", "Atletismo", Attribute::Physical),
    skill("crime", "Crime", Attribute::Physical),
    skill("furtividade", "Furtividade", Attribute::Physical),
    skill("luta", "Luta", Attribute::Physical),
    skill("pontaria", "Pontaria", Attribute::Physical),
    skill("vigor", "Vigor", Attribute::Physical),
    // Mente
    skill("aptidao", "Aptidão", Attribute::Mind),
    specialization("artes", "Artes", "aptidao"),
    specialization("atualidades", "Atualidades", "aptidao"),
    specialization("burocracia", "Burocracia", "aptidao"),
    specialization("exatas", "Exatas", "aptidao"),
    specialization("humanas", "Humanas", "aptidao"),
    specialization("tatica", "Tática", "aptidao"),
    skill("maquinas", "Máquinas", Attribute::Mind),
    skill("medicina", "Medicina", Attribute::Mind),
    skill("ocultismo", "Ocultismo", Attribute::Mind),
    skill("percepcao", "Percepção", Attribute::Mind),
    skill("pesquisar", "Pesquisar", Attribute::Mind),
    skill("sobrevivencia", "Sobrevivência", Attribute::Mind),
    skill("tecnologia", "Tecnologia", Attribute::Mind),
    // Emoção
    skill("disciplina", "Disciplina", Attribute::Emotion),
    skill("enganacao", "Enganação", Attribute::Emotion),
    skill("intimidar", "Intimidar", Attribute::Emotion),
    skill("intuicao", "Intuição", Attribute::Emotion),
    skill("persuasao", "Persuasão", Attribute::Emotion),
];

pub fn default_skills() -> Vec<Skill> {
    DEFAULT_SKILLS
        .iter()
        .map(|definition| definition.to_skill())
        .collect()
}

pub fn skill_definition(id: &str) -> Option<&'static SkillDefinition> {
    let id = id.trim();
    DEFAULT_SKILLS
        .iter()
        .find(|definition| definition.id.eq_ignore_ascii_case(id))
}

pub fn skills_for(attribute: Attribute) -> Vec<&'static SkillDefinition> {
    DEFAULT_SKILLS
        .iter()
        .filter(|definition| definition.governed_by == attribute)
        .collect()
}

#[derive(Debug, Clone, Serialize)]
pub struct BuiltinDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub magnitudes: &'static [u32],
    pub per_test: bool,
}

pub const BUILTIN_EFFECTS: &[BuiltinDefinition] = &[
    BuiltinDefinition {
        id: "machucado",
        name: "Machucado",
        description: "Físico -1 Passo",
        magnitudes: &[1],
        per_test: false,
    },
    BuiltinDefinition {
        id: "desatencao",
        name: "Desatenção",
        description: "Mente -1 Passo",
        magnitudes: &[1],
        per_test: false,
    },
    BuiltinDefinition {
        id: "irritacao",
        name: "Irritação",
        description: "Emoção -1 Passo",
        magnitudes: &[1],
        per_test: false,
    },
    BuiltinDefinition {
        id: "ajuda",
        name: "Ajuda",
        description: "+1 ou +2 Passos em um teste selecionado",
        magnitudes: &[1, 2],
        per_test: true,
    },
];

pub fn builtin_definition(id: &str) -> Option<&'static BuiltinDefinition> {
    let id = id.trim();
    BUILTIN_EFFECTS
        .iter()
        .find(|definition| definition.id.eq_ignore_ascii_case(id))
}

pub fn builtin(id: &str, magnitude: Option<u32>) -> Result<ActiveEffect, String> {
    let definition =
        builtin_definition(id).ok_or_else(|| format!("Unknown built-in effect: {}", id))?;

    let magnitude = magnitude.unwrap_or(definition.magnitudes[0]);
    if !definition.magnitudes.contains(&magnitude) {
        return Err(format!(
            "'{}' does not support a magnitude of {}. Allowed: {:?}.",
            definition.name, magnitude, definition.magnitudes
        ));
    }

    let (operation, target) = match definition.id {
        "machucado" => (EffectOperation::Subtract, Some(Attribute::Physical.key())),
        "desatencao" => (EffectOperation::Subtract, Some(Attribute::Mind.key())),
        "irritacao" => (EffectOperation::Subtract, Some(Attribute::Emotion.key())),
        "ajuda" => (EffectOperation::Advance, None),
        other => return Err(format!("Unhandled built-in effect: {}", other)),
    };

    Ok(ActiveEffect {
        id: definition.id.to_string(),
        name: definition.name.to_string(),
        source: EffectSource::Builtin,
        effects: vec![Effect {
            operation,
            quantity: magnitude,
            unit: EffectUnit::Step,
            target: target.map(str::to_string),
        }],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CharacterSheet;

    #[test]
    fn the_catalog_matches_the_specified_mappings() {
        assert_eq!(skills_for(Attribute::Physical).len(), 7);
        // Mente carries Aptidão, its six specializations, and seven more skills.
        assert_eq!(skills_for(Attribute::Mind).len(), 14);
        assert_eq!(skills_for(Attribute::Emotion).len(), 5);
    }

    #[test]
    fn catalog_ids_are_unique_and_ascii() {
        let mut seen: Vec<&str> = Vec::new();
        for definition in DEFAULT_SKILLS {
            assert!(
                definition.id.is_ascii() && !definition.id.contains(' '),
                "{} is not a stable ascii id",
                definition.id
            );
            assert!(!seen.contains(&definition.id), "duplicate {}", definition.id);
            seen.push(definition.id);
        }
    }

    #[test]
    fn specializations_point_at_aptidao() {
        for id in ["artes", "atualidades", "burocracia", "exatas", "humanas", "tatica"] {
            let definition = skill_definition(id).unwrap();
            assert_eq!(definition.parent, Some("aptidao"));
        }
    }

    #[test]
    fn every_skill_starts_untrained() {
        assert!(default_skills()
            .iter()
            .all(|skill| skill.value == UNTRAINED_SKILL_DIE));
    }

    #[test]
    fn the_builtin_library_holds_exactly_four_entries() {
        assert_eq!(BUILTIN_EFFECTS.len(), 4);
        for id in ["machucado", "desatencao", "irritacao", "ajuda"] {
            assert!(builtin_definition(id).is_some(), "missing {id}");
        }
        assert!(builtin("qualquer_outro", None).is_err());
    }

    #[test]
    fn the_three_debuffs_lower_their_attribute_by_one_step() {
        for (id, attribute) in [
            ("machucado", Attribute::Physical),
            ("desatencao", Attribute::Mind),
            ("irritacao", Attribute::Emotion),
        ] {
            let effect = builtin(id, None).unwrap();
            assert_eq!(effect.effects[0].signed_steps(), -1);
            assert_eq!(effect.effects[0].target.as_deref(), Some(attribute.key()));
            assert_eq!(effect.source, EffectSource::Builtin);
        }
    }

    #[test]
    fn ajuda_accepts_one_or_two_steps_only() {
        assert_eq!(builtin("ajuda", Some(1)).unwrap().effects[0].signed_steps(), 1);
        assert_eq!(builtin("ajuda", Some(2)).unwrap().effects[0].signed_steps(), 2);
        assert!(builtin("ajuda", Some(3)).is_err());
        assert!(builtin("machucado", Some(2)).is_err());
    }

    #[test]
    fn builtins_validate_against_a_real_sheet() {
        let mut sheet = CharacterSheet::new("Teste", "Combatente", "Policial");
        for definition in BUILTIN_EFFECTS {
            sheet.active_effects.push(builtin(definition.id, None).unwrap());
        }
        sheet.validate().unwrap();
    }

    #[test]
    fn saving_throws_map_to_the_right_skills() {
        assert_eq!(death_save_skill(ResourceKind::Hp), "vigor");
        assert_eq!(death_save_skill(ResourceKind::Dp), "disciplina");
        assert!(skill_definition(HP_SAVE_SKILL).is_some());
        assert!(skill_definition(DP_SAVE_SKILL).is_some());
    }
}
