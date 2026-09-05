//! The wire contract between the hosting instance and every joined client.
//!
//! Everything that crosses the WebSocket is defined here so that the Rust side
//! and `src/features/session/net/protocol.ts` can be kept in step by reading a
//! single file on each end.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::CharacterSheet;

/// Default LAN port. Chosen high enough to avoid privileged-port prompts.
pub const LAN_PORT: u16 = 37373;

/// How many chat/roll entries a joining client receives as backlog.
pub const HISTORY_LIMIT: usize = 200;

/// A participant as tracked by the host.
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

/// A character file the host is willing to hand out, summarised for the
/// selection screen so clients never need the campaign directory themselves.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SheetSummary {
    /// File name relative to the game instance root, e.g. `alan.md`.
    pub id: String,
    pub name: String,
    pub profile: String,
    pub occupation: String,
    pub level: u32,
}

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Announce (or re-announce) identity. Re-sending updates the roster entry.
    Join {
        #[serde(rename = "clientId")]
        client_id: String,
        username: String,
        color: String,
    },
    /// Take ownership of a character sheet.
    Claim {
        #[serde(rename = "clientId")]
        client_id: String,
        #[serde(rename = "sheetId")]
        sheet_id: String,
    },
    /// Give up the currently claimed sheet.
    Release {
        #[serde(rename = "clientId")]
        client_id: String,
    },
    /// A chat line.
    Text(ChatEnvelope),
    /// A dice result rendered as a chat line.
    Roll(ChatEnvelope),
    /// A remote procedure call against the host's rules engine.
    Rpc {
        #[serde(rename = "requestId")]
        request_id: String,
        method: String,
        #[serde(default)]
        params: Value,
    },
}

/// Chat payloads are produced by the UI and echoed back to everyone verbatim,
/// so only the two fields the host actually reasons about are modelled here.
/// Every other key is ignored on the way in and preserved on the way out
/// because the original text is what gets rebroadcast.
#[derive(Debug, Clone, Deserialize)]
pub struct ChatEnvelope {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(rename = "rollResult", default)]
    pub roll_result: Option<Value>,
}

impl ChatEnvelope {
    /// Secret rolls are only delivered to their author and the GM.
    pub fn is_secret(&self) -> bool {
        self.roll_result
            .as_ref()
            .and_then(|result| result.get("secret"))
            .and_then(Value::as_bool)
            .unwrap_or(false)
    }
}

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Full roster, sent whenever presence or claims change.
    RosterSync { players: Vec<Player> },
    /// Everything a (re)joining client needs to catch up.
    SessionState {
        sheets: Vec<SheetSummary>,
        history: Vec<Value>,
        players: Vec<Player>,
        #[serde(rename = "gameId")]
        game_id: String,
    },
    /// A sheet changed on disk; anyone displaying it should refresh.
    SheetUpdate {
        #[serde(rename = "sheetId")]
        sheet_id: String,
        sheet: CharacterSheet,
    },
    /// Result of a `Rpc` request.
    RpcResult {
        #[serde(rename = "requestId")]
        request_id: String,
        ok: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        data: Option<Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    /// The host closed the table.
    SessionClosed { reason: String },
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

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/// Who a broadcast is meant for. Every connection filters on this before
/// writing to its socket, which is what keeps secret rolls secret.
#[derive(Debug, Clone)]
pub enum Target {
    All,
    Only(Vec<String>),
}

/// A pre-serialised outbound message plus its routing rule.
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

/// RPC method names. Kept as constants so a typo fails to compile rather than
/// silently returning "unknown method" at runtime.
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
