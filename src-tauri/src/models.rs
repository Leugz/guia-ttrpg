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
