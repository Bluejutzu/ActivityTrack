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

use std::sync::{Arc, Mutex};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

use crate::state::{AppState, Status};

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Build immutable app state and kick off the tracker before the UI exists —
    // tracking must run whether or not anyone opens the window.
    let config = config::load_config();
    let state = Arc::new(AppState {
        config,
        device_id: device::get_or_create_device_id(),
        hostname: host::hostname(),
        windows_user: host::windows_user(),
        status: Mutex::new(Status::default()),
    });
    tracker::start(state.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::verify_password
        ])
        .setup(|app| {
            // Launch on logon so the tracker is always present.
            let _ = app.autolaunch().enable();

            // System-tray icon with a minimal menu. Left-click opens the window.
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

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it to the tray instead of quitting, so
            // the tracker keeps running. Quit only via the tray menu.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running ActivityTrack");
}
