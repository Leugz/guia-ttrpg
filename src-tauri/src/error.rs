//! The one error type crossing the IPC bridge.
//!
//! Every handler in `commands.rs` returns `AppResult<T>`. The variant is
//! serialised alongside the message as `{ "kind": "...", "message": "..." }`,
//! so the frontend can branch on `kind` instead of pattern-matching on
//! human-readable Portuguese prose that is free to change at any time.
//!
//! Two bridges keep the rest of the crate compiling unchanged while the
//! conversion works its way down:
//!
//! * `From<String>` folds a legacy `Result<_, String>` from `storage`,
//!   `campaign`, `models`, `effects` or `dice` into `AppError::Rules`, so `?`
//!   keeps working inside `api`.
//! * `From<AppError>` back to `String` keeps `network::session::dispatch`
//!   compiling, since the LAN protocol carries errors as a bare string.

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    /// The addressed sheet, entry, effect, map or handout does not exist.
    #[error("{0}")]
    NotFound(String),

    /// The caller passed something the domain cannot interpret at all — an
    /// unknown resource key, an unparseable attribute, a bad die size.
    #[error("{0}")]
    InvalidInput(String),

    /// The document is internally inconsistent and must not reach the disk.
    #[error("{0}")]
    Validation(String),

    /// The request is well-formed but the current state forbids it: toggling a
    /// trigger-only entry, saving when nothing is downed, removing an effect
    /// that is not applied.
    #[error("{0}")]
    Conflict(String),

    /// A rules-layer refusal that has not been given a sharper variant yet.
    #[error("{0}")]
    Rules(String),

    /// The process-wide state or the LAN session is not available.
    #[error("{0}")]
    State(String),

    /// A filesystem failure, kept alongside the path that caused it — the
    /// bare `io::Error` says "No such file" and nothing about which file.
    #[error("{context}: {source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },
}

impl AppError {
    pub fn not_found(message: impl Into<String>) -> Self {
        AppError::NotFound(message.into())
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        AppError::InvalidInput(message.into())
    }

    pub fn validation(message: impl Into<String>) -> Self {
        AppError::Validation(message.into())
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        AppError::Conflict(message.into())
    }

    pub fn state(message: impl Into<String>) -> Self {
        AppError::State(message.into())
    }

    pub fn io(context: impl Into<String>, source: std::io::Error) -> Self {
        AppError::Io {
            context: context.into(),
            source,
        }
    }

    /// The discriminant the frontend switches on. Stable: renaming one of
    /// these is a breaking change to the IPC contract.
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "not_found",
            AppError::InvalidInput(_) => "invalid_input",
            AppError::Validation(_) => "validation",
            AppError::Conflict(_) => "conflict",
            AppError::Rules(_) => "rules",
            AppError::State(_) => "state",
            AppError::Io { .. } => "io",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut payload = serializer.serialize_struct("AppError", 2)?;
        payload.serialize_field("kind", self.kind())?;
        payload.serialize_field("message", &self.to_string())?;
        payload.end()
    }
}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        AppError::Rules(message)
    }
}

impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        AppError::Rules(message.to_string())
    }
}

/// Lets `network::session::dispatch`, which speaks the string-shaped LAN
/// protocol, keep calling `api::*` with `?`.
impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn errors_serialise_with_a_machine_readable_kind() {
        let json = serde_json::to_string(&AppError::not_found("no sheet")).unwrap();
        assert_eq!(json, r#"{"kind":"not_found","message":"no sheet"}"#);
    }

    #[test]
    fn legacy_string_errors_round_trip_through_the_bridge() {
        let error: AppError = "boom".to_string().into();
        assert_eq!(error.kind(), "rules");
        assert_eq!(String::from(error), "boom");
    }
}
