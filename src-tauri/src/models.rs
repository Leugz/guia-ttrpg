use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterSheet {
    #[serde(rename = "type")]
    pub sheet_type: String,
    pub nome: String,
    pub perfil: String,
    pub ocupacao: String,
    pub nivel: u32,
    pub recursos: Recursos,
    pub atributos_base: AtributosBase,
    pub habilidades: Vec<Habilidade>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Recursos {
    pub pv: ResourceStat,
    pub pd: ResourceStat,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceStat {
    pub atual: i32,
    pub max: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AtributosBase {
    pub fisico: String,
    pub mente: String,
    pub emocao: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Habilidade {
    pub nome: String,
    pub descricao: String,
    pub ativa: bool,
}

#[derive(Debug, Serialize)]
pub struct ParsedDocument {
    pub data: CharacterSheet,
    pub body: String,
}
