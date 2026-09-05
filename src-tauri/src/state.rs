//! Shared runtime state.
//!
//! The rules engine (`api`) has to be able to tell connected players that a
//! sheet changed, but it is deliberately free of Tauri and Axum types so it can
//! be unit tested. The `HUB` below is the seam: `api` publishes through it, and
//! when nothing is hosting the publish is a no-op.

use std::collections::HashMap;
use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use serde::Serialize;
use tokio::sync::{broadcast, oneshot, RwLock};

use crate::network::protocol::{Envelope, Player, Target};

/// The table currently being hosted by this instance.
pub struct HostedSession {
    pub game_id: String,
    pub root: PathBuf,
    /// The GM's client id. Used for permission checks and secret-roll routing.
    pub host_client_id: String,
    pub address: String,
    /// Dropping/sending on this stops the Axum server.
    pub shutdown: Option<oneshot::Sender<()>>,
}

pub struct AppState {
    pub tx: broadcast::Sender<Envelope>,
    pub db_path: PathBuf,
    pub roster: RwLock<HashMap<String, Player>>,
    pub session: RwLock<Option<HostedSession>>,
}

impl AppState {
    pub fn new(db_path: PathBuf) -> Self {
        let (tx, _rx) = broadcast::channel(256);
        AppState {
            tx,
            db_path,
            roster: RwLock::new(HashMap::new()),
            session: RwLock::new(None),
        }
    }

    /// Roster ordered deterministically so the avatar row does not reshuffle on
    /// every presence update.
    pub async fn players(&self) -> Vec<Player> {
        let roster = self.roster.read().await;
        let mut players: Vec<Player> = roster.values().cloned().collect();
        players.sort_by(|a, b| a.username.cmp(&b.username).then(a.client_id.cmp(&b.client_id)));
        players
    }

    pub async fn host_client_id(&self) -> Option<String> {
        self.session
            .read()
            .await
            .as_ref()
            .map(|session| session.host_client_id.clone())
    }

    pub async fn game_root(&self) -> Option<PathBuf> {
        self.session
            .read()
            .await
            .as_ref()
            .map(|session| session.root.clone())
    }

    pub fn send(&self, target: Target, payload: String) {
        // An error here only means nobody is listening yet, which is normal
        // before the first player connects.
        let _ = self.tx.send(Envelope { target, payload });
    }
}

static HUB: OnceLock<Arc<AppState>> = OnceLock::new();

pub fn install(state: Arc<AppState>) {
    if HUB.set(state).is_err() {
        tracing::warn!("application state was installed twice; keeping the first instance");
    }
}

pub fn hub() -> Option<Arc<AppState>> {
    HUB.get().cloned()
}

/// Serialise and route a message. Silently does nothing when no session is up,
/// which is what keeps `api` usable from plain unit tests.
pub fn publish<T: Serialize>(target: Target, message: &T) {
    let Some(state) = hub() else {
        return;
    };
    match serde_json::to_string(message) {
        Ok(payload) => state.send(target, payload),
        Err(error) => tracing::error!(%error, "failed to serialise an outbound message"),
    }
}

/// Best-effort discovery of the address other machines should dial.
///
/// Opening a UDP socket towards a public address makes the OS pick the
/// interface backing the default route without sending a single packet. It is
/// the most reliable way to get the right address on a machine that also has
/// Hamachi/Radmin/Docker adapters, and it falls back to loopback when the host
/// is fully offline.
pub fn local_ip() -> Option<IpAddr> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("9.9.9.9:53").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn player(client_id: &str, username: &str) -> Player {
        Player {
            client_id: client_id.into(),
            username: username.into(),
            claimed_sheet: None,
            color: "#71717a".into(),
            connected: true,
            is_gm: false,
        }
    }

    #[tokio::test]
    async fn the_roster_is_returned_in_a_stable_order() {
        let state = AppState::new(PathBuf::from("/tmp/none.db"));
        {
            let mut roster = state.roster.write().await;
            roster.insert("c".into(), player("c", "Victor"));
            roster.insert("a".into(), player("a", "Alan"));
            roster.insert("b".into(), player("b", "Kenia"));
        }
        let names: Vec<String> = state
            .players()
            .await
            .into_iter()
            .map(|p| p.username)
            .collect();
        assert_eq!(names, vec!["Alan", "Kenia", "Victor"]);
    }

    #[test]
    fn publishing_without_a_session_is_harmless() {
        // No hub installed in this test binary path: must not panic.
        publish(Target::All, &serde_json::json!({ "type": "noop" }));
    }
}
