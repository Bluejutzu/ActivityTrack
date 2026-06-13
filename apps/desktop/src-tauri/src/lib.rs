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

use crate::model::AGENT_VERSION;
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
    // Load config (reads config.json + device.key file).
    let mut config = config::load_config();

    let device_id = device::get_or_create_device_id();
    let hostname = host::hostname();
    let windows_user = host::windows_user();

    // Auto-enroll on first boot if we have an enrollment code but no device key.
    // This is a blocking network call before the UI starts — intentional, so the
    // tracker is sending data by the time the tray icon appears.
    if !config.can_send() && config.can_register() {
        let code = config.enrollment_code.clone().unwrap_or_default();
        match sender::register_device(
            &config.convex_url,
            &config.bootstrap_key,
            &code,
            &device_id,
            &hostname,
            &windows_user,
            AGENT_VERSION,
        ) {
            Ok(key) => {
                let key_path = paths::device_key_file();
                let _ = std::fs::create_dir_all(paths::app_dir());
                match std::fs::write(&key_path, &key) {
                    Ok(()) => {
                        config.device_key = Some(key);
                    }
                    Err(e) => {
                        eprintln!("ActivityTrack: cannot persist device key: {e}");
                        // Still set in-memory so this session can send data.
                        config.device_key = Some(key);
                    }
                }
            }
            Err(e) => {
                eprintln!("ActivityTrack: enrollment failed: {e}");
            }
        }
    }

    let state = Arc::new(AppState {
        config,
        device_id,
        hostname,
        windows_user,
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
