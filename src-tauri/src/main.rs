#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_updater::UpdaterExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let Ok(updater) = handle.updater() else {
                    return;
                };
                let Ok(Some(update)) = updater.check().await else {
                    return;
                };

                if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
                    handle.restart();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Strive");
}
