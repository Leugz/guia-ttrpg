//! LAN multiplayer: the wire protocol, the Axum server and the per-connection
//! session handling.

pub mod protocol;
pub mod server;
pub mod session;

pub use server::HostInfo;
