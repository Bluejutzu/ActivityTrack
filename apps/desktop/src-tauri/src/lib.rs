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

use crate::model::AGENT_VERSION;
use crate::state::AppState;

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
    let mut enrollment_error: Option<String> = None;
    let mut key_persist_warning: Option<String> = None;
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
                if let Err(e) = std::fs::write(&key_path, &key) {
                    eprintln!("ActivityTrack: cannot persist device key: {e}");
                    key_persist_warning = Some(format!(
                        "Enrolled, but the device key could not be saved to disk ({e}); \
                         re-enrollment will be required after restart."
                    ));
                }
                // Set in-memory so this session can send data regardless.
                config.device_key = Some(key);
            }
            Err(e) => {
                eprintln!("ActivityTrack: enrollment failed: {e}");
                enrollment_error = Some(e);
            }
        }
    }

    let state = Arc::new(AppState::new(config, device_id, hostname, windows_user));

    // Surface any startup problems so they show in the tray UI immediately
    // (and, once enrolled, get reported to the dashboard on the next tick).
    if let Some(err) = enrollment_error {
        state.push_error("tracker.enroll_failed", err);
    }
    if let Some(warn) = key_persist_warning {
        state.push_error("tracker.queue_io", warn.clone());
        state.report_event("warning", "tracker.queue_io", &warn);
    }

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
