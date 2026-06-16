mod commands;
mod config;
mod device;
mod host;
mod idle;
mod model;
mod paths;
mod queue;
mod sender;
mod state;
mod tracker;

use std::sync::Arc;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_updater::UpdaterExt;

use crate::state::AppState;

async fn check_for_update(handle: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    if let Some(update) = handle.updater()?.check().await? {
        update.download_and_install(|_chunk, _total| {}, || {}).await?;
    }
    Ok(())
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = config::load_config();
    let device_key = config::load_device_key();

    let device_id = device::get_or_create_device_id();
    let hostname = host::hostname();
    let windows_user = host::windows_user();

    // Build state and start the tracker immediately so the tray icon appears at
    // once. First-boot enrollment (a blocking network call) now happens inside
    // the tracker thread, not here — a slow/down backend no longer freezes
    // startup. The tracker's flush guard defers sending until enrolled.
    let state = Arc::new(AppState::new(
        config,
        device_id,
        hostname,
        windows_user,
        device_key,
    ));

    tracker::start(state.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::verify_password,
            commands::enroll,
            commands::get_diagnostics,
        ])
        .setup(|app| {
            let _ = app.autolaunch().enable();

            let open = MenuItem::with_id(app, "open", "Open ActivityTrack", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .expect("bundle icon configured");

            TrayIconBuilder::with_id("main")
                .icon(icon)
                .tooltip("ActivityTrack")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // Check for updates in the background so startup is not delayed.
            // If a newer version is available, the NSIS installer runs passively
            // and the app is restarted by the installer.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = check_for_update(handle).await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running ActivityTrack");
}
