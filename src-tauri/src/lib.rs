//! KORZ CORE — startup, state, plugins, commands and shutdown.

mod audio;
mod commands;
mod db;
mod error;
mod library;
mod smartlink;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use tauri::{Manager, RunEvent};

use commands::AppState;

const DEFAULT_VOLUME: f32 = 0.8;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Logs go to stdout and to <app log dir>/KORZ Music.log (rotated at 2 MB).
        .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).max_file_size(2_000_000).build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol("korzcover", |ctx, request| commands::cover_response(ctx.app_handle(), &request))
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let covers = app.path().app_cache_dir()?.join("covers");
            std::fs::create_dir_all(&data_dir)?;
            std::fs::create_dir_all(&covers)?;
            let db = Arc::new(db::Db::open(&data_dir.join("korz.db"))?);
            let volume = db
                .setting("volume")?
                .and_then(|v| v.parse::<f32>().ok())
                .filter(|v| (0.0..=1.0).contains(v))
                .unwrap_or(DEFAULT_VOLUME);
            let engine = audio::AudioEngine::start(app.handle().clone(), db.clone(), volume);
            app.manage(AppState { db, engine, covers, scanning: Arc::new(AtomicBool::new(false)) });
            log::info!("KORZ Music {} démarré ({})", app.package_info().version, data_dir.display());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::library_add_folder,
            commands::library_rescan,
            commands::library_folders,
            commands::library_remove_folder,
            commands::library_stats,
            commands::library_tracks,
            commands::library_albums,
            commands::library_recent_albums,
            commands::library_artists,
            commands::history_recent,
            commands::favorite_toggle,
            commands::playlists_list,
            commands::playlist_get,
            commands::playlist_create,
            commands::playlist_rename,
            commands::playlist_delete,
            commands::playlist_add,
            commands::playlist_remove,
            commands::player_play,
            commands::player_enqueue,
            commands::player_jump,
            commands::player_toggle,
            commands::player_next,
            commands::player_previous,
            commands::player_seek,
            commands::player_set_volume,
            commands::player_state,
            commands::smartlink_parse,
        ])
        .build(tauri::generate_context!())
        .expect("échec du démarrage de KORZ Music");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = handle.try_state::<AppState>() {
                state.engine.shutdown();
            }
            log::info!("KORZ Music fermé");
        }
    });
}
