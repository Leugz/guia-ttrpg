use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{CharacterSheet, MapDefinition, MapToken, SaveIndicator};

pub const LAN_PORT: u16 = 37373;

pub const HISTORY_LIMIT: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub client_id: String,
    pub username: String,
    pub claimed_sheet: Option<String>,
    pub color: String,
    #[serde(default)]
    pub connected: bool,
    #[serde(default)]
    pub is_gm: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JukeboxState {
    pub track_url: String,
    pub looped: bool,
    pub playing: bool,
    pub position: f64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SheetSummary {
    pub id: String,
    pub name: String,
    pub profile: String,
    pub occupation: String,
    pub level: u8,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum JukeboxPayload {
    Play { track_url: String, looped: bool },
    Pause,
    Resume,
    Stop,
    Seek { position: f64 },
    SetLoop { looped: bool },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum ToolPayload {
    Ping {
        x: f64,
        y: f64,
        color: String,
    },
    Ruler {
        start_x: f64,
        start_y: f64,
        end_x: f64,
        end_y: f64,
        color: String,
    },
    RulerClear,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        #[serde(rename = "clientId")]
        client_id: String,
        username: String,
        color: String,
    },
    Claim {
        #[serde(rename = "clientId")]
        client_id: String,
        #[serde(rename = "sheetId")]
        sheet_id: String,
    },
    Release {
        #[serde(rename = "clientId")]
        client_id: String,
    },
    Text(ChatEnvelope),
    Roll(ChatEnvelope),
    TokenPlace {
        #[serde(rename = "clientId")]
        _client_id: String,
        token: MapToken,
    },
    TokenMove {
        #[serde(rename = "clientId")]
        _client_id: String,
        #[serde(rename = "tokenId")]
        token_id: String,
        x: f64,
        y: f64,
        #[serde(default)]
        dragging: bool,
    },
    TokenState {
        #[serde(rename = "clientId")]
        _client_id: String,
        #[serde(rename = "tokenId")]
        token_id: String,
        #[serde(default)]
        grayscale: bool,
        #[serde(default)]
        save_indicator: Option<SaveIndicator>,
    },
    TokenRemove {
        #[serde(rename = "clientId")]
        _client_id: String,
        #[serde(rename = "tokenId")]
        token_id: String,
    },
    Tool {
        #[serde(rename = "clientId")]
        _client_id: String,
        payload: ToolPayload,
    },
    Rpc {
        #[serde(rename = "requestId")]
        request_id: String,
        method: String,
        #[serde(default)]
        params: Value,
    },

    Jukebox {
        #[serde(rename = "clientId")]
        _client_id: String,
        payload: JukeboxPayload,
    },
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatEnvelope {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(rename = "rollResult", default)]
    pub roll_result: Option<Value>,
}

impl ChatEnvelope {
    pub fn is_secret(&self) -> bool {
        self.roll_result
            .as_ref()
            .and_then(|result| result.get("secret"))
            .and_then(Value::as_bool)
            .unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    RosterSync {
        players: Vec<Player>,
    },
    SessionState {
        sheets: Vec<SheetSummary>,
        history: Vec<Value>,
        players: Vec<Player>,
        #[serde(rename = "gameId")]
        game_id: String,
        handouts: Vec<crate::models::Handout>,
        maps: Vec<MapDefinition>,
        tokens: Vec<MapToken>,
        #[serde(default)]
        jukebox: Option<JukeboxState>,
    },
    SheetUpdate {
        #[serde(rename = "sheetId")]
        sheet_id: String,
        sheet: CharacterSheet,
    },
    HandoutUpdate {
        handout: crate::models::Handout,
    },
    HandoutForceOpen {
        #[serde(rename = "handoutId")]
        handout_id: String,
        target: Option<String>,
    },
    MapsUpdate {
        maps: Vec<MapDefinition>,
    },
    TokensSync {
        tokens: Vec<MapToken>,
    },
    TokenMoved {
        #[serde(rename = "tokenId")]
        token_id: String,
        x: f64,
        y: f64,
        dragging: bool,
    },
    ToolSync {
        #[serde(rename = "clientId")]
        client_id: String,
        payload: ToolPayload,
    },
    JukeboxSync {
        payload: JukeboxPayload,
    },
    RpcResult {
        #[serde(rename = "requestId")]
        request_id: String,
        ok: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        data: Option<Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    SessionClosed {
        reason: String,
    },
}

impl ServerMessage {
    pub fn ok(request_id: String, data: Value) -> Self {
        ServerMessage::RpcResult {
            request_id,
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(request_id: String, error: impl Into<String>) -> Self {
        ServerMessage::RpcResult {
            request_id,
            ok: false,
            data: None,
            error: Some(error.into()),
        }
    }
}

#[derive(Debug, Clone)]
pub enum Target {
    All,
    Only(Vec<String>),
}

#[derive(Debug, Clone)]
pub struct Envelope {
    pub target: Target,
    pub payload: String,
}

impl Envelope {
    pub fn reaches(&self, client_id: Option<&str>) -> bool {
        match &self.target {
            Target::All => true,
            Target::Only(ids) => match client_id {
                Some(id) => ids.iter().any(|candidate| candidate == id),
                None => false,
            },
        }
    }
}

pub mod method {
    pub const LIST_SHEETS: &str = "list_sheets";
    pub const LOAD_SHEET: &str = "load_sheet";
    pub const APPLY_RESOURCE_CHANGE: &str = "apply_resource_change";
    pub const ROLL_DEATH_SAVE: &str = "roll_death_save";
    pub const STEP_ATTRIBUTE: &str = "step_attribute";
    pub const STEP_SKILL: &str = "step_skill";
    pub const TOGGLE_ENTRY: &str = "toggle_entry";
    pub const APPLY_BUILTIN_EFFECT: &str = "apply_builtin_effect";
    pub const REMOVE_ACTIVE_EFFECT: &str = "remove_active_effect";
    pub const PREVIEW_TEST: &str = "preview_test";
    pub const ROLL_TEST: &str = "roll_test";
    pub const DESCRIBE_ENTRY: &str = "describe_entry";
    pub const GRANT_SHEET_ACCESS: &str = "grant_sheet_access";
    pub const REVOKE_SHEET_ACCESS: &str = "revoke_sheet_access";
    pub const ROLL_DICE: &str = "roll_dice";
    pub const TOGGLE_HANDOUT_PUBLIC: &str = "toggle_handout_public";
    pub const TOGGLE_HANDOUT_SHARE: &str = "toggle_handout_share";
    pub const OPEN_HANDOUT_FOR_ALL: &str = "open_handout_for_all";
    pub const OPEN_HANDOUT_FOR_PLAYER: &str = "open_handout_for_player";
    pub const GET_HANDOUT_ASSET: &str = "get_handout_asset";
    pub const LIST_MAPS: &str = "list_maps";
    pub const SET_ACTIVE_MAP: &str = "set_active_map";
    pub const GET_MAP_ASSET: &str = "get_map_asset";
    pub const GET_SHEET_PORTRAIT: &str = "get_sheet_portrait";
    pub const GET_SHEET_TOKEN_IMAGE: &str = "get_sheet_token_image";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_messages_use_the_camel_case_keys_the_ui_sends() {
        let raw = r##"{"type":"join","clientId":"abc","username":"Leu","color":"#ae2c12"}"##;
        match serde_json::from_str::<ClientMessage>(raw).unwrap() {
            ClientMessage::Join {
                client_id,
                username,
                color,
            } => {
                assert_eq!(client_id, "abc");
                assert_eq!(username, "Leu");
                assert_eq!(color, "#ae2c12");
            }
            other => panic!("unexpected variant: {other:?}"),
        }
    }

    #[test]
    fn chat_payloads_survive_the_round_trip_untouched() {
        let raw = r##"{"type":"text","id":"1","sender":"ALAN","color":"#ae2c12","content":"oi"}"##;
        match serde_json::from_str::<ClientMessage>(raw).unwrap() {
            ClientMessage::Text(envelope) => {
                assert_eq!(envelope.id.as_deref(), Some("1"));
                assert!(!envelope.is_secret());
            }
            other => panic!("unexpected variant: {other:?}"),
        }
    }

    #[test]
    fn secret_rolls_are_detected_from_the_nested_result() {
        let raw = r#"{"type":"roll","id":"2","rollResult":{"secret":true,"total_sum":9}}"#;
        match serde_json::from_str::<ClientMessage>(raw).unwrap() {
            ClientMessage::Roll(envelope) => assert!(envelope.is_secret()),
            other => panic!("unexpected variant: {other:?}"),
        }
    }

    #[test]
    fn unknown_message_types_are_rejected_instead_of_panicking() {
        assert!(serde_json::from_str::<ClientMessage>(r#"{"type":"nonsense"}"#).is_err());
        assert!(serde_json::from_str::<ClientMessage>("not json").is_err());
    }

    #[test]
    fn targeted_envelopes_only_reach_their_recipients() {
        let envelope = Envelope {
            target: Target::Only(vec!["gm".into(), "alan".into()]),
            payload: String::new(),
        };
        assert!(envelope.reaches(Some("gm")));
        assert!(!envelope.reaches(Some("edgar")));
        assert!(!envelope.reaches(None));

        let broadcast = Envelope {
            target: Target::All,
            payload: String::new(),
        };
        assert!(broadcast.reaches(None));
    }
}
