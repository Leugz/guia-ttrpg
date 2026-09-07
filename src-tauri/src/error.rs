use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    InvalidInput(String),

    #[error("{0}")]
    Validation(String),

    #[error("{0}")]
    Conflict(String),

    #[error("{0}")]
    Rules(String),

    #[error("{0}")]
    State(String),

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
