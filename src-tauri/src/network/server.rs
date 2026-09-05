//! The LAN server's lifecycle.
//!
//! The previous build bound a listener at application start on every machine,
//! including clients that were only ever going to join someone else's table.
//! The server now starts when a GM opens a table and stops when they leave, so
//! a player who is only joining never opens a port at all.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{ws::WebSocketUpgrade, State},
    routing::get,
    Router,
};
use serde::Serialize;
use tokio::sync::oneshot;

use crate::network::protocol::{ServerMessage, Target, LAN_PORT};
use crate::network::session;
use crate::state::{self, AppState, HostedSession};

/// What the UI needs in order to tell players where to connect.
#[derive(Debug, Clone, Serialize)]
pub struct HostInfo {
    pub address: String,
    pub port: u16,
}

/// Open a table. Idempotent: hosting the same game twice is a no-op that
/// returns the existing address rather than fighting over the port.
pub async fn start(
    state: Arc<AppState>,
    game_id: String,
    root: PathBuf,
    host_client_id: String,
) -> Result<HostInfo, String> {
    {
        let session = state.session.read().await;
        if let Some(existing) = session.as_ref() {
            if existing.game_id == game_id {
                return Ok(HostInfo {
                    address: existing.address.clone(),
                    port: LAN_PORT,
                });
            }
        }
    }

    // A different table was open: close it before rebinding.
    stop(state.clone(), "O mestre encerrou a sessão anterior.").await;

    if !root.is_dir() {
        return Err(format!(
            "Game instance directory does not exist: {}",
            root.display()
        ));
    }

    let bind_addr = SocketAddr::from(([0, 0, 0, 0], LAN_PORT));
    let listener = tokio::net::TcpListener::bind(bind_addr)
        .await
        .map_err(|e| format!("Could not bind {}: {}", bind_addr, e))?;

    let address = match state::local_ip() {
        Some(ip) => format!("{}:{}", ip, LAN_PORT),
        None => format!("127.0.0.1:{}", LAN_PORT),
    };

    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    {
        let mut session = state.session.write().await;
        *session = Some(HostedSession {
            game_id: game_id.clone(),
            root,
            host_client_id,
            address: address.clone(),
            shutdown: Some(shutdown_tx),
        });
    }

    let router = Router::new()
        .route("/ws", get(upgrade))
        .with_state(state.clone());

    tokio::spawn(async move {
        tracing::info!(%bind_addr, game_id, "LAN server listening");
        let served = axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await;
        if let Err(error) = served {
            tracing::error!(%error, "LAN server stopped unexpectedly");
        } else {
            tracing::info!("LAN server stopped");
        }
    });

    Ok(HostInfo {
        address,
        port: LAN_PORT,
    })
}

/// Close the table, tell everyone why, and release the port.
pub async fn stop(state: Arc<AppState>, reason: &str) {
    let shutdown = {
        let mut session = state.session.write().await;
        match session.take() {
            Some(mut hosted) => hosted.shutdown.take(),
            None => return,
        }
    };

    state::publish(
        Target::All,
        &ServerMessage::SessionClosed {
            reason: reason.to_string(),
        },
    );

    state.roster.write().await.clear();

    if let Some(shutdown) = shutdown {
        // Receiver dropped means the task already finished; either way we are
        // no longer hosting.
        let _ = shutdown.send(());
    }
}

async fn upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> axum::response::Response {
    ws.on_upgrade(move |socket| session::handle_socket(socket, state))
}
