use serde::ser::{Serialize, SerializeStruct, Serializer};

/// Every command returns this; the frontend receives `{ code, message }`.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Base de données : {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Fichier : {0}")]
    Io(#[from] std::io::Error),
    #[error("Lecture audio : {0}")]
    Audio(String),
    #[error("{0}")]
    Invalid(String),
    #[error("Introuvable : {0}")]
    NotFound(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Db(_) => "db",
            AppError::Io(_) => "io",
            AppError::Audio(_) => "audio",
            AppError::Invalid(_) => "invalid",
            AppError::NotFound(_) => "not_found",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
