//! One task per connected player.
//!
//! The host is authoritative: clients never touch the campaign directory. They
//! send `rpc` requests naming a sheet by file name, the host resolves that name
//! inside the game instance, runs the same `api` function the GM's own window
//! would run, and answers on the socket. Sheet writes additionally fan out a
//! `sheet_update` so every open copy stays in step.

use std::path::PathBuf;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use serde::Deserialize;
use serde_json::Value;
use tokio::sync::broadcast::error::RecvError;

use crate::api;
use crate::campaign;
use crate::effects::TestRequest;
use crate::history;
use crate::network::protocol::{
    method, ChatEnvelope, ClientMessage, Player, ServerMessage, Target, HISTORY_LIMIT,
};
use crate::state::AppState;

pub async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.tx.subscribe();
    // Unknown until the client sends `join`; targeted traffic is withheld until
    // then, which also stops an unidentified socket from seeing secret rolls.
    let mut client_id: Option<String> = None;

    loop {
        tokio::select! {
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        if let Some(reply) = handle_text(&state, &mut client_id, &text).await {
                            if socket.send(Message::Text(reply)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    // Ping/Pong are answered by Axum; binary frames are not part
                    // of the protocol and are ignored rather than fatal.
                    Some(Ok(_)) => {}
                    Some(Err(error)) => {
                        tracing::debug!(%error, "websocket receive failed");
                        break;
                    }
                }
            }
            outgoing = rx.recv() => {
                match outgoing {
                    Ok(envelope) => {
                        if !envelope.reaches(client_id.as_deref()) {
                            continue;
                        }
                        if socket.send(Message::Text(envelope.payload)).await.is_err() {
                            break;
                        }
                    }
                    // A slow client missing a few broadcasts is survivable: the
                    // next roster/sheet update carries the full state anyway.
                    Err(RecvError::Lagged(skipped)) => {
                        tracing::warn!(skipped, "client fell behind the broadcast channel");
                    }
                    Err(RecvError::Closed) => break,
                }
            }
        }
    }

    disconnect(&state, client_id).await;
}

/// Mark the player offline but keep their claim so an automatic reconnect
/// restores the session instead of creating a duplicate.
async fn disconnect(state: &Arc<AppState>, client_id: Option<String>) {
    let Some(client_id) = client_id else {
        return;
    };
    {
        let mut roster = state.roster.write().await;
        if let Some(player) = roster.get_mut(&client_id) {
            player.connected = false;
        }
    }
    tracing::info!(client_id, "player disconnected");
    broadcast_roster(state).await;
}

/// Returns an optional direct reply for this socket only.
async fn handle_text(
    state: &Arc<AppState>,
    client_id: &mut Option<String>,
    text: &str,
) -> Option<String> {
    let message = match serde_json::from_str::<ClientMessage>(text) {
        Ok(message) => message,
        Err(error) => {
            // Malformed input is rejected and logged, never trusted.
            tracing::warn!(%error, "rejected malformed websocket message");
            return None;
        }
    };

    match message {
        ClientMessage::Join {
            client_id: id,
            username,
            color,
        } => {
            *client_id = Some(id.clone());
            join(state, &id, &username, &color).await;
            None
        }
        ClientMessage::Claim {
            client_id: id,
            sheet_id,
        } => {
            claim(state, &id, &sheet_id).await;
            None
        }
        ClientMessage::Release { client_id: id } => {
            {
                let mut roster = state.roster.write().await;
                if let Some(player) = roster.get_mut(&id) {
                    player.claimed_sheet = None;
                }
            }
            broadcast_roster(state).await;
            None
        }
        ClientMessage::Text(envelope) | ClientMessage::Roll(envelope) => {
            relay_chat(state, client_id.as_deref(), envelope, text).await;
            None
        }
        ClientMessage::Rpc {
            request_id,
            method,
            params,
        } => {
            let response = rpc(state, client_id.as_deref(), request_id, &method, params).await;
            serde_json::to_string(&response).ok()
        }
    }
}

async fn join(state: &Arc<AppState>, client_id: &str, username: &str, color: &str) {
    let is_gm = state
        .host_client_id()
        .await
        .is_some_and(|host| host == client_id);

    {
        let mut roster = state.roster.write().await;
        let entry = roster
            .entry(client_id.to_string())
            .or_insert_with(|| Player {
                client_id: client_id.to_string(),
                username: username.to_string(),
                claimed_sheet: None,
                color: color.to_string(),
                connected: true,
                is_gm,
            });
        // Re-sending `join` refreshes identity without dropping the claim, which
        // is what makes reconnects restore rather than duplicate a session.
        entry.username = username.to_string();
        entry.color = color.to_string();
        entry.connected = true;
        entry.is_gm = is_gm;
    }

    tracing::info!(client_id, username, is_gm, "player joined");
    send_session_state(state, client_id).await;
    broadcast_roster(state).await;
}

async fn claim(state: &Arc<AppState>, client_id: &str, sheet_id: &str) {
    let taken = {
        let roster = state.roster.read().await;
        roster.values().any(|player| {
            player.client_id != client_id
                && player.connected
                && player.claimed_sheet.as_deref() == Some(sheet_id)
        })
    };
    if taken {
        tracing::info!(client_id, sheet_id, "refused an already claimed sheet");
        return;
    }

    {
        let mut roster = state.roster.write().await;
        if let Some(player) = roster.get_mut(client_id) {
            player.claimed_sheet = Some(sheet_id.to_string());
        }
    }
    broadcast_roster(state).await;
}

async fn relay_chat(
    state: &Arc<AppState>,
    sender: Option<&str>,
    envelope: ChatEnvelope,
    raw: &str,
) {
    let game_id = {
        let session = state.session.read().await;
        match session.as_ref() {
            Some(session) => session.game_id.clone(),
            None => String::new(),
        }
    };

    // Find whoever claimed the __GM__ role, rather than assuming it's the host machine
    let gm_client_id = {
        let roster = state.roster.read().await;
        roster
            .values()
            .find(|p| p.claimed_sheet.as_deref() == Some("__GM__"))
            .map(|p| p.client_id.clone())
    };

    let target = if envelope.is_secret() {
        let mut recipients = Vec::new();
        if let Some(gm) = gm_client_id {
            recipients.push(gm);
        }
        if let Some(sender_id) = sender {
            let s = sender_id.to_string();
            if !recipients.contains(&s) {
                recipients.push(s);
            }
        }
        Target::Only(recipients)
    } else {
        Target::All
    };

    if !envelope.is_secret() {
        if let Some(id) = envelope.id.as_deref() {
            if let Err(error) = history::record(&state.db_path, &game_id, id, raw) {
                tracing::warn!(%error, "failed to persist a chat entry");
            }
        }
    }

    state.send(target, raw.to_string());
}

pub async fn broadcast_roster(state: &Arc<AppState>) {
    let players = state.players().await;
    let message = ServerMessage::RosterSync { players };
    match serde_json::to_string(&message) {
        Ok(payload) => state.send(Target::All, payload),
        Err(error) => tracing::error!(%error, "failed to serialise the roster"),
    }
}

async fn send_session_state(state: &Arc<AppState>, client_id: &str) {
    let (game_id, root) = {
        let session = state.session.read().await;
        match session.as_ref() {
            Some(session) => (session.game_id.clone(), session.root.clone()),
            None => return,
        }
    };

    let sheets = campaign::list_sheets(&root).unwrap_or_else(|error| {
        tracing::error!(%error, "failed to list sheets for a joining client");
        Vec::new()
    });
    let history = history::recent(&state.db_path, &game_id, HISTORY_LIMIT).unwrap_or_default();
    let players = state.players().await;

    let message = ServerMessage::SessionState {
        sheets,
        history,
        players,
        game_id,
    };
    match serde_json::to_string(&message) {
        Ok(payload) => state.send(Target::Only(vec![client_id.to_string()]), payload),
        Err(error) => tracing::error!(%error, "failed to serialise the session state"),
    }
}

// ---------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct SheetParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
}

#[derive(Debug, Deserialize)]
struct ResourceParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
    resource: String,
    #[serde(default)]
    delta: i32,
}

#[derive(Debug, Deserialize)]
struct StepAttributeParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
    attribute: String,
    steps: i32,
}

#[derive(Debug, Deserialize)]
struct StepSkillParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
    #[serde(rename = "skillId")]
    skill_id: String,
    steps: i32,
}

#[derive(Debug, Deserialize)]
struct ToggleEntryParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
    #[serde(rename = "entryId")]
    entry_id: String,
    active: bool,
}

#[derive(Debug, Deserialize)]
struct EffectParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
    #[serde(rename = "effectId")]
    effect_id: String,
    #[serde(default)]
    magnitude: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct EntryParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
    #[serde(rename = "entryId")]
    entry_id: String,
}

#[derive(Debug, Deserialize)]
struct TestParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
    request: TestRequest,
}

#[derive(Debug, Deserialize)]
struct AccessParams {
    #[serde(rename = "sheetId")]
    sheet_id: String,
    reference: String,
}

/// Methods that write to disk and therefore need an ownership check.
fn is_mutating(method: &str) -> bool {
    matches!(
        method,
        method::APPLY_RESOURCE_CHANGE
            | method::ROLL_DEATH_SAVE
            | method::STEP_ATTRIBUTE
            | method::STEP_SKILL
            | method::TOGGLE_ENTRY
            | method::APPLY_BUILTIN_EFFECT
            | method::REMOVE_ACTIVE_EFFECT
            | method::GRANT_SHEET_ACCESS
            | method::REVOKE_SHEET_ACCESS
    )
}

/// The sheet a request targets, if any.
fn requested_sheet(params: &Value) -> Option<String> {
    params
        .get("sheetId")
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// A player may edit the sheet they claimed; the GM may edit anything; and a
/// claimed sheet's `accessible_sheets` list extends that permission, which is
/// how the GM hands out extra sheets.
async fn may_mutate(
    state: &Arc<AppState>,
    client_id: &str,
    sheet_id: &str,
    root: &PathBuf,
) -> bool {
    if state
        .host_client_id()
        .await
        .is_some_and(|host| host == client_id)
    {
        return true;
    }

    let claimed = {
        let roster = state.roster.read().await;
        roster
            .get(client_id)
            .and_then(|player| player.claimed_sheet.clone())
    };
    let Some(claimed) = claimed else {
        return false;
    };
    if claimed == sheet_id {
        return true;
    }

    let Ok(path) = campaign::resolve_sheet(root, &claimed) else {
        return false;
    };
    let Some(path) = path.to_str() else {
        return false;
    };
    match api::load_character_sheet(path) {
        Ok(document) => document
            .data
            .accessible_sheets
            .iter()
            .any(|reference| reference.eq_ignore_ascii_case(sheet_id)),
        Err(_) => false,
    }
}

async fn rpc(
    state: &Arc<AppState>,
    client_id: Option<&str>,
    request_id: String,
    method: &str,
    params: Value,
) -> ServerMessage {
    let Some(client_id) = client_id else {
        return ServerMessage::err(request_id, "Identify with a join message first.");
    };

    let Some(root) = state.game_root().await else {
        return ServerMessage::err(request_id, "No table is currently being hosted.");
    };

    if is_mutating(method) {
        let Some(sheet_id) = requested_sheet(&params) else {
            return ServerMessage::err(request_id, "This request must name a sheet.");
        };
        if !may_mutate(state, client_id, &sheet_id, &root).await {
            tracing::warn!(client_id, sheet_id, method, "rejected an unauthorised edit");
            return ServerMessage::err(
                request_id,
                "You do not have permission to edit that character sheet.",
            );
        }
    }

    // File IO must not run on the async executor; each request gets its own
    // blocking task so one slow disk cannot stall the whole table.
    let method = method.to_string();
    let dispatched = tokio::task::spawn_blocking(move || dispatch(&root, &method, params)).await;

    match dispatched {
        Ok(Ok(data)) => ServerMessage::ok(request_id, data),
        Ok(Err(reason)) => ServerMessage::err(request_id, reason),
        Err(error) => {
            tracing::error!(%error, "rpc worker panicked");
            ServerMessage::err(request_id, "The host failed to process that request.")
        }
    }
}

fn to_value<T: serde::Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|e| format!("Failed to serialise the response: {}", e))
}

fn parse<T: serde::de::DeserializeOwned>(params: Value) -> Result<T, String> {
    serde_json::from_value(params).map_err(|e| format!("Invalid request parameters: {}", e))
}

fn sheet_path(root: &PathBuf, sheet_id: &str) -> Result<String, String> {
    let path = campaign::resolve_sheet(root, sheet_id)?;
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| "Sheet path is not valid UTF-8.".to_string())
}

/// Blocking dispatch: one arm per supported method, each delegating to `api`.
fn dispatch(root: &PathBuf, method: &str, params: Value) -> Result<Value, String> {
    match method {
        method::LIST_SHEETS => to_value(campaign::list_sheets(root)?),

        method::LOAD_SHEET => {
            let p: SheetParams = parse(params)?;
            to_value(api::load_character_sheet(&sheet_path(root, &p.sheet_id)?)?)
        }

        method::APPLY_RESOURCE_CHANGE => {
            let p: ResourceParams = parse(params)?;
            to_value(api::apply_resource_change(
                &sheet_path(root, &p.sheet_id)?,
                &p.resource,
                p.delta,
            )?)
        }

        method::ROLL_DEATH_SAVE => {
            let p: ResourceParams = parse(params)?;
            to_value(api::roll_death_save(
                &sheet_path(root, &p.sheet_id)?,
                &p.resource,
            )?)
        }

        method::STEP_ATTRIBUTE => {
            let p: StepAttributeParams = parse(params)?;
            to_value(api::step_attribute(
                &sheet_path(root, &p.sheet_id)?,
                &p.attribute,
                p.steps,
            )?)
        }

        method::STEP_SKILL => {
            let p: StepSkillParams = parse(params)?;
            to_value(api::step_skill(
                &sheet_path(root, &p.sheet_id)?,
                &p.skill_id,
                p.steps,
            )?)
        }

        method::TOGGLE_ENTRY => {
            let p: ToggleEntryParams = parse(params)?;
            to_value(api::toggle_entry(
                &sheet_path(root, &p.sheet_id)?,
                &p.entry_id,
                p.active,
            )?)
        }

        method::APPLY_BUILTIN_EFFECT => {
            let p: EffectParams = parse(params)?;
            to_value(api::apply_builtin_effect(
                &sheet_path(root, &p.sheet_id)?,
                &p.effect_id,
                p.magnitude,
            )?)
        }

        method::REMOVE_ACTIVE_EFFECT => {
            let p: EffectParams = parse(params)?;
            to_value(api::remove_active_effect(
                &sheet_path(root, &p.sheet_id)?,
                &p.effect_id,
            )?)
        }

        method::PREVIEW_TEST => {
            let p: TestParams = parse(params)?;
            to_value(api::preview_test(
                &sheet_path(root, &p.sheet_id)?,
                &p.request,
            )?)
        }

        method::ROLL_TEST => {
            let p: TestParams = parse(params)?;
            to_value(api::roll_test(&sheet_path(root, &p.sheet_id)?, &p.request)?)
        }

        method::DESCRIBE_ENTRY => {
            let p: EntryParams = parse(params)?;
            to_value(api::describe_entry(
                &sheet_path(root, &p.sheet_id)?,
                &p.entry_id,
            )?)
        }

        method::GRANT_SHEET_ACCESS => {
            let p: AccessParams = parse(params)?;
            to_value(api::grant_sheet_access(
                &sheet_path(root, &p.sheet_id)?,
                &p.reference,
            )?)
        }

        method::REVOKE_SHEET_ACCESS => {
            let p: AccessParams = parse(params)?;
            to_value(api::revoke_sheet_access(
                &sheet_path(root, &p.sheet_id)?,
                &p.reference,
            )?)
        }

        unknown => Err(format!("Unknown method: {}", unknown)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("guia-session-{tag}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        api::create_character_sheet(
            dir.join("alan.md").to_str().unwrap(),
            "ALAN",
            "EXECUTOR",
            "CIENTISTA",
        )
        .unwrap();
        dir
    }

    #[test]
    fn mutating_methods_are_recognised() {
        assert!(is_mutating(method::APPLY_RESOURCE_CHANGE));
        assert!(is_mutating(method::TOGGLE_ENTRY));
        assert!(!is_mutating(method::LOAD_SHEET));
        assert!(!is_mutating(method::PREVIEW_TEST));
        assert!(!is_mutating(method::LIST_SHEETS));
    }

    #[test]
    fn a_client_can_load_a_sheet_by_file_name() {
        let root = scratch("load");
        let value = dispatch(&root, method::LOAD_SHEET, json!({ "sheetId": "alan.md" })).unwrap();
        assert_eq!(value["data"]["name"], "ALAN");
    }

    #[test]
    fn resource_changes_round_trip_through_the_rpc_layer() {
        let root = scratch("resource");
        let value = dispatch(
            &root,
            method::APPLY_RESOURCE_CHANGE,
            json!({ "sheetId": "alan.md", "resource": "hp", "delta": -4 }),
        )
        .unwrap();
        assert_eq!(value["character"]["resources"]["hp"]["current"], 6);

        let reloaded =
            dispatch(&root, method::LOAD_SHEET, json!({ "sheetId": "alan.md" })).unwrap();
        assert_eq!(reloaded["data"]["resources"]["hp"]["current"], 6);
    }

    #[test]
    fn a_test_can_be_previewed_and_rolled_remotely() {
        let root = scratch("test");
        let request = json!({
            "sheetId": "alan.md",
            "request": { "skill_id": "furtividade", "triggered": [], "extra_dice": [], "secret": false }
        });
        let preview = dispatch(&root, method::PREVIEW_TEST, request.clone()).unwrap();
        assert_eq!(preview["dice"].as_array().unwrap().len(), 2);

        let rolled = dispatch(&root, method::ROLL_TEST, request).unwrap();
        assert!(rolled["result"]["total_sum"].as_u64().unwrap() >= 2);
    }

    #[test]
    fn sheet_ids_that_escape_the_game_root_are_refused() {
        let root = scratch("escape");
        assert!(dispatch(
            &root,
            method::LOAD_SHEET,
            json!({ "sheetId": "../../../etc/passwd.md" })
        )
        .is_err());
        assert!(dispatch(
            &root,
            method::LOAD_SHEET,
            json!({ "sheetId": "sub/alan.md" })
        )
        .is_err());
    }

    #[test]
    fn malformed_parameters_produce_an_error_not_a_panic() {
        let root = scratch("params");
        assert!(dispatch(&root, method::LOAD_SHEET, json!({})).is_err());
        assert!(dispatch(&root, "nonsense", json!({})).is_err());
        assert!(dispatch(
            &root,
            method::STEP_SKILL,
            json!({ "sheetId": "alan.md", "skillId": "furtividade" })
        )
        .is_err());
    }

    #[test]
    fn listing_sheets_needs_no_parameters() {
        let root = scratch("list");
        let value = dispatch(&root, method::LIST_SHEETS, Value::Null).unwrap();
        assert_eq!(value.as_array().unwrap().len(), 1);
        assert_eq!(value[0]["id"], "alan.md");
    }
}
