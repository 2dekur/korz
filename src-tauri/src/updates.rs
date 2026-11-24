//! Auto-update through the signed GitHub releases (`plugins.updater` in tauri.conf.json).

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::UpdaterExt;

use crate::commands::AppState;
use crate::error::{AppError, AppResult};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    current: String,
    notes: Option<String>,
}

fn err(e: tauri_plugin_updater::Error) -> AppError {
    AppError::Update(e.to_string())
}

/// `None` when the installed version is the latest.
#[tauri::command]
pub async fn update_check(app: AppHandle) -> AppResult<Option<UpdateInfo>> {
    let update = app.updater().map_err(err)?.check().await.map_err(err)?;
    Ok(update.map(|u| UpdateInfo { version: u.version, current: u.current_version, notes: u.body }))
}

/// Downloads and verifies the signed installer, then hands over to it. On Windows the installer
/// replaces the app and relaunches it; this process exits without running `RunEvent::Exit`.
#[tauri::command]
pub async fn update_install(app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    let update = app.updater().map_err(err)?.check().await.map_err(err)?.ok_or_else(|| AppError::NotFound("mise à jour".into()))?;
    log::info!("téléchargement de la version {}", update.version);
    let bytes = update.download(|_, _| {}, || {}).await.map_err(err)?;
    state.engine.shutdown();
    log::info!("installation de la version {}", update.version);
    update.install(bytes).map_err(err)?;
    app.restart()
}
