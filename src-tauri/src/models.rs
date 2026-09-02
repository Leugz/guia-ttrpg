use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterSheet {
    #[serde(rename = "type")]
    pub sheet_type: String,
    pub name: String,
    pub profile: String,
    pub occupation: String,
    pub level: u32,
    pub resources: Resources,
    pub base_attributes: BaseAttributes,
    pub abilities: Vec<Ability>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Resources {
    pub hp: ResourceStat,
    pub dp: ResourceStat,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceStat {
    pub current: i32,
    pub max: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BaseAttributes {
    pub physical: String,
    pub mind: String,
    pub emotion: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Ability {
    pub name: String,
    pub description: String,
    pub active: bool,
}

#[derive(Debug, Serialize)]
pub struct ParsedDocument {
    pub data: CharacterSheet,
    pub body: String,
}

impl CharacterSheet {
    /// Validates the business logic constraints of the character sheet.
    pub fn validate(&self) -> Result<(), String> {
        // 1. Level Bounds
        if self.level == 0 || self.level > 99 {
            return Err(format!(
                "Invalid level: {}. Must be between 1 and 99.",
                self.level
            ));
        }

        // 2. Resource Integrity
        if self.resources.hp.current > self.resources.hp.max {
            return Err("Current HP cannot exceed Max HP.".into());
        }
        if self.resources.dp.current > self.resources.dp.max {
            return Err("Current DP cannot exceed Max DP.".into());
        }

        // 3. Step Dice Validation
        let valid_dice = ["D4", "D6", "D8", "D10", "D12"];
        let attrs = [
            &self.base_attributes.physical,
            &self.base_attributes.mind,
            &self.base_attributes.emotion,
        ];

        for attr in attrs {
            let upper_attr = attr.to_uppercase();
            if !valid_dice.contains(&upper_attr.as_str()) {
                return Err(format!(
                    "Invalid step die: {}. Must be D4, D6, D8, D10, or D12.",
                    attr
                ));
            }
        }

        Ok(())
    }
}
