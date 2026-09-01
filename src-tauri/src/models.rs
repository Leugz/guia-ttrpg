use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterSheet {
    #[serde(rename = "type")]
    pub sheet_type: String,
    #[serde(rename = "nome")]
    pub name: String,
    #[serde(rename = "perfil")]
    pub profile: String,
    #[serde(rename = "ocupacao")]
    pub occupation: String,
    #[serde(rename = "nivel")]
    pub level: u32,
    #[serde(rename = "recursos")]
    pub resources: Resources,
    #[serde(rename = "atributos_base")]
    pub base_attributes: BaseAttributes,
    #[serde(rename = "habilidades")]
    pub abilities: Vec<Ability>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Resources {
    pub pv: ResourceStat, // Acronyms PV/PD are fine to keep as domain-specific identifiers
    pub pd: ResourceStat,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceStat {
    #[serde(rename = "atual")]
    pub current: i32,
    pub max: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BaseAttributes {
    #[serde(rename = "fisico")]
    pub physical: String,
    #[serde(rename = "mente")]
    pub mind: String,
    #[serde(rename = "emocao")]
    pub emotion: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Ability {
    #[serde(rename = "nome")]
    pub name: String,
    #[serde(rename = "descricao")]
    pub description: String,
    #[serde(rename = "ativa")]
    pub active: bool,
}

#[derive(Debug, Serialize)]
pub struct ParsedDocument {
    pub data: CharacterSheet,
    pub body: String,
}
