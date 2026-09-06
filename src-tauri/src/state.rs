//! Shared runtime state.
//!
//! The rules engine (`api`) has to be able to tell connected players that a
//! sheet changed, but it is deliberately free of Tauri and Axum types so it can
//! be unit tested. The `HUB` below is the seam: `api` publishes through it, and
//! when nothing is hosting the publish is a no-op.

use std::collections::HashMap;
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use serde::Serialize;
use tokio::sync::{broadcast, oneshot, RwLock};

use crate::models::MapToken;
use crate::network::protocol::{Envelope, Player, Target};
use crate::storage;

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

/// The pieces on the table, and the table they belong to.
///
/// The `game_id`/`root` pair is the whole point of this type. The board used to
/// be a bare map hanging off `AppState`, which meant it outlived the table that
/// filled it: closing one game and opening another handed the new table the old
/// table's pieces, and quitting the application threw them away entirely. A
/// board is now opened from, and saved to, one file inside one game instance.
#[derive(Default)]
pub struct Board {
    /// `None` when no table is open, which is what makes every mutation below
    /// a no-op instead of a leak into whichever game is opened next.
    pub game_id: Option<String>,
    pub root: Option<PathBuf>,
    pub tokens: HashMap<String, MapToken>,
}

impl Board {
    pub fn is_open(&self) -> bool {
        self.game_id.is_some()
    }

    /// Board contents in a stable order so two clients never disagree about
    /// which token is drawn on top.
    pub fn snapshot(&self) -> Vec<MapToken> {
        let mut list: Vec<MapToken> = self.tokens.values().cloned().collect();
        list.sort_by(|a, b| a.id.cmp(&b.id));
        list
    }

    fn save(&self) -> Result<(), String> {
        let Some(root) = self.root.as_ref() else {
            return Ok(());
        };
        storage::write_board(root, &self.snapshot())
    }
}

pub struct AppState {
    pub tx: broadcast::Sender<Envelope>,
    pub db_path: PathBuf,
    pub roster: RwLock<HashMap<String, Player>>,
    pub session: RwLock<Option<HostedSession>>,
    /// Pieces currently on the board, belonging to exactly one game instance.
    ///
    /// Kept in memory while the table is open — a token moves many times a
    /// second while it is dragged and no file should be rewritten at that rate
    /// — and flushed to the game's own `board.json` whenever the board changes
    /// shape or a drag ends. The host stays the single source of truth, so a
    /// reconnecting player is handed the current board rather than trusting
    /// whatever their own tab happened to remember.
    pub board: RwLock<Board>,
}

impl AppState {
    pub fn new(db_path: PathBuf) -> Self {
        let (tx, _rx) = broadcast::channel(256);
        AppState {
            tx,
            db_path,
            roster: RwLock::new(HashMap::new()),
            session: RwLock::new(None),
            board: RwLock::new(Board::default()),
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

    pub async fn board_snapshot(&self) -> Vec<MapToken> {
        self.board.read().await.snapshot()
    }

    /// Load the board belonging to `game_id`, replacing whatever was in memory.
    ///
    /// A missing file is an empty board, not an error: a table nobody has
    /// played yet simply starts bare.
    pub async fn open_board(&self, game_id: &str, root: &Path) {
        let tokens = storage::read_board(root);
        let restored = tokens.len();
        let mut board = self.board.write().await;
        board.game_id = Some(game_id.to_string());
        board.root = Some(root.to_path_buf());
        board.tokens = tokens
            .into_iter()
            .map(|token| (token.id.clone(), token))
            .collect();
        tracing::info!(game_id, restored, "board loaded");
    }

    /// Save the board and forget it, so the next table starts from its own file
    /// rather than from these leftovers.
    pub async fn close_board(&self) {
        let mut board = self.board.write().await;
        if !board.is_open() {
            return;
        }
        if let Err(error) = board.save() {
            tracing::error!(%error, "failed to save the board");
        }
        *board = Board::default();
    }

    /// Write the board out. Cheap enough to call for every structural change
    /// and at the end of a drag; deliberately not called for every frame of one.
    pub async fn persist_board(&self) {
        let board = self.board.read().await;
        if let Err(error) = board.save() {
            tracing::error!(%error, "failed to save the board");
        }
    }

    /// True when this client placed the token. Callers combine this with the
    /// GM check, since the GM may rearrange anything on the board while a
    /// player may only touch their own piece.
    pub async fn owns_token(&self, client_id: &str, token_id: &str) -> bool {
        let board = self.board.read().await;
        board
            .tokens
            .get(token_id)
            .is_some_and(|token| token.owner_client_id == client_id)
    }

    /// Whoever is running the table: the machine hosting it, or whoever has
    /// claimed the `__GM__` role on it. Both count, which matters because the
    /// GM is not required to be the host.
    pub async fn is_gm(&self, client_id: &str) -> bool {
        if self
            .host_client_id()
            .await
            .is_some_and(|host| host == client_id)
        {
            return true;
        }
        let roster = self.roster.read().await;
        roster
            .get(client_id)
            .is_some_and(|player| player.claimed_sheet.as_deref() == Some("__GM__"))
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

    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("guia-board-{tag}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn token(id: &str) -> MapToken {
        MapToken {
            id: id.into(),
            map_id: "terreo".into(),
            owner_client_id: "gm".into(),
            sheet_id: None,
            label: id.into(),
            color: "#71717a".into(),
            x: 10.0,
            y: 20.0,
            grayscale: false,
            save_indicator: None,
        }
    }

    #[tokio::test]
    async fn a_board_is_reloaded_for_the_game_that_saved_it() {
        let root = scratch("reload");
        let state = AppState::new(PathBuf::from("/tmp/none.db"));

        state.open_board("mesa_a", &root).await;
        state
            .board
            .write()
            .await
            .tokens
            .insert("t1".into(), token("t1"));
        state.close_board().await;

        assert!(state.board_snapshot().await.is_empty());

        state.open_board("mesa_a", &root).await;
        let restored = state.board_snapshot().await;
        assert_eq!(restored.len(), 1);
        assert_eq!(restored[0].id, "t1");
    }

    #[tokio::test]
    async fn one_games_board_never_shows_up_in_another() {
        let first = scratch("isolation-a");
        let second = scratch("isolation-b");
        let state = AppState::new(PathBuf::from("/tmp/none.db"));

        state.open_board("mesa_a", &first).await;
        state
            .board
            .write()
            .await
            .tokens
            .insert("t1".into(), token("t1"));
        state.close_board().await;

        // Opening the second table must not inherit the first table's pieces,
        // and closing it must not overwrite the first table's file.
        state.open_board("mesa_b", &second).await;
        assert!(state.board_snapshot().await.is_empty());
        state.close_board().await;

        state.open_board("mesa_a", &first).await;
        assert_eq!(state.board_snapshot().await.len(), 1);
    }

    #[test]
    fn publishing_without_a_session_is_harmless() {
        // No hub installed in this test binary path: must not panic.
        publish(Target::All, &serde_json::json!({ "type": "noop" }));
    }
}
