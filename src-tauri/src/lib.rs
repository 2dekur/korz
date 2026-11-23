mod stream;

use std::sync::Arc;

#[tauri::command]
fn get_hwid() -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let out = std::process::Command::new("reg")
        .args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let guid = stdout
        .lines()
        .find(|l| l.contains("MachineGuid"))
        .and_then(|l| l.split_whitespace().last())
        .unwrap_or("unknown");
    let hash = Sha256::digest(guid.as_bytes());
    Ok(format!("{:x}", hash)[..32].to_string())
}

use tauri::webview::WebviewWindowBuilder;
use tauri::Manager;
use tauri_plugin_store::StoreExt;

/// Reads `settings.hardwareAcceleration` from the same store file the frontend writes.
/// Defaults to `true` when the store or key is missing.
fn hardware_acceleration_enabled(app: &tauri::App) -> bool {
    app.store("settings.json")
        .ok()
        .and_then(|store| store.get("settings"))
        .and_then(|settings| settings.get("hardwareAcceleration")?.as_bool())
        .unwrap_or(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // `korzstream://localhost/<videoId>`: range-served full-length audio (see stream.rs).
        .register_asynchronous_uri_scheme_protocol("korzstream", |ctx, request, responder| {
            let s = ctx.app_handle().state::<Arc<stream::Streams>>().inner().clone();
            tauri::async_runtime::spawn(async move { responder.respond(s.serve(request).await) });
        })
        .invoke_handler(tauri::generate_handler![stream::resolve_stream, stream::prefetch_stream, stream::ytm_lyrics, stream::lyrics_search, get_hwid])
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // After fs: restores folder grants (fs + asset protocol) made through the dialog in earlier sessions.
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Managed before the window exists, so the protocol and commands always find it.
            let cache = app.path().app_cache_dir().ok().map(|d| d.join("rustypipe"));
            let streams = Arc::new(stream::Streams::new(cache));
            app.manage(streams.clone());
            tauri::async_runtime::spawn(async move { streams.discover().await });

            let hw_accel = hardware_acceleration_enabled(app);
            let config = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .cloned()
                .expect("main window missing from tauri.conf.json");

            #[allow(unused_mut)]
            let mut builder = WebviewWindowBuilder::from_config(app.handle(), &config)?;

            // WebView2 browser args are fixed at creation, so the toggle applies on next launch.
            #[cfg(windows)]
            if !hw_accel {
                // Setting args replaces Tauri's WebView2 defaults, so they are repeated here.
                builder = builder.additional_browser_args(
                    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-gpu",
                );
            }
            #[cfg(not(windows))]
            let _ = hw_accel;

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
