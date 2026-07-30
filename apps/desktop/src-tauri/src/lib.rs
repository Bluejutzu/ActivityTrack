mod commands;
mod config;
mod device;
mod host;
mod idle;
mod log;
mod model;
mod paths;
mod queue;
mod sender;
mod state;
mod tracker;
mod updater_apply;

use std::sync::Arc;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_updater::UpdaterExt;

use crate::state::AppState;

async fn check_for_update(handle: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    let _ = handle.emit("update:checking", ());

    match handle.updater()?.check().await {
        Ok(Some(update)) => {
            let version = update.version.to_string();
            let _ = handle.emit("update:available", &version);

            let _ = handle.emit("update:installing", ());
            match update.download(|_chunk, _total| {}, || {}).await {
                Ok(bytes) => match crate::updater_apply::stage_and_run(&bytes) {
                    Ok(()) => {
                        let _ = handle.emit("update:installed", ());
                        println!("Update to {} staged, applying via scheduled task", version);
                        // Mirrors what Update::install itself did (ShellExecute
                        // then exit(0)): the installer's /UPDATE /ARGS flow (see
                        // installer.nsh) detects and closes the running instance,
                        // so exiting here just avoids racing it for our own
                        // exe's file lock rather than depending on it.
                        std::process::exit(0);
                    }
                    Err(e) => {
                        let error_msg = format!("Update installation failed: {}", e);
                        let _ = handle.emit("update:error", &error_msg);
                        println!("{}", error_msg);
                    }
                },
                Err(e) => {
                    let error_msg = format!("Update download failed: {}", e);
                    let _ = handle.emit("update:error", &error_msg);
                    println!("{}", error_msg);
                }
            }
        }
        Ok(None) => {
            let _ = handle.emit("update:uptodate", ());
            println!("App is up to date");
        }
        Err(e) => {
            let error_msg = format!("Update check failed: {}", e);
            let _ = handle.emit("update:error", &error_msg);
            println!("{}", error_msg);
        }
    }
    Ok(())
}

/// Show the main window, recreating it first if it was destroyed. Closing the
/// window now tears down its webview instead of merely hiding it (see the
/// `run` closure below), so the app has no persistent UI process while unused.
fn show_main(app: &tauri::AppHandle) {
    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => {
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("ActivityTrack")
            .inner_size(560.0, 640.0)
            .resizable(true)
            .skip_taskbar(true)
            .center();
            match builder.build() {
                Ok(w) => w,
                Err(_) => return,
            }
        }
    };
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = config::load_config();
    let device_key = config::load_device_key();

    let device_id = device::get_or_create_device_id();
    let hostname = host::hostname();
    let windows_user = host::windows_user();

    // Build state and start the tracker immediately so the tray icon appears at
    // once. First-boot pairing (the register/approval-poll network calls) happens
    // inside the tracker thread, not here — a slow/down backend no longer freezes
    // startup. The tracker's flush guard defers sending until a token is claimed.
    let state = Arc::new(AppState::new(
        config,
        device_id,
        hostname,
        windows_user,
        device_key,
    ));

    tracker::start(state.clone());

    tauri::Builder::default()
        // Must be the FIRST plugin: a second launch (e.g. another user session, or
        // a stray double-start) hands its args to this callback and exits, instead
        // of running a duplicate tracker against the same device-id — which would
        // double-count samples. We just surface the already-running window.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::verify_password,
            commands::get_diagnostics,
        ])
        .setup(|app| {
            // Autostart is registered per-machine (HKLM Run key) by the NSIS
            // installer so the tracker launches for every user in their
            // interactive session. We deliberately do NOT enable the per-user
            // (HKCU) autostart plugin here, which would only cover the user who
            // first ran the app and double-register on that machine.

            // Tray icon is opt-in (config.json "showTrayIcon"), off by default:
            // employees are informed of monitoring out-of-band, so the agent
            // otherwise runs with zero persistent UI. When hidden, the window is
            // reopened by relaunching the exe (the single-instance plugin
            // forwards that into `show_main`, which recreates the destroyed
            // webview — see `on_window_event` below).
            if app.state::<Arc<AppState>>().config.show_tray_icon {
                let open =
                    MenuItem::with_id(app, "open", "Open ActivityTrack", true, None::<&str>)?;
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
            }

            // Check for updates in the background so startup is not delayed.
            // If a newer version is available, the NSIS installer runs passively
            // and the app is restarted by the installer.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = check_for_update(handle).await;
            });

            // Re-check periodically: this is a tray-resident app that can stay up
            // for days/weeks, so a startup-only check would leave long-running
            // machines stuck on an old build. Runs on its own thread and blocks on
            // the updater future so we don't depend on a specific async timer.
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(6 * 60 * 60));
                tauri::async_runtime::block_on(async {
                    let _ = check_for_update(handle.clone()).await;
                });
            });

            Ok(())
        })
        // No CloseRequested override: closing the window now lets it actually
        // close (destroying the WebView2 instance) instead of hiding it. The
        // window is opened rarely (pairing/login/status checks), so there's no
        // reason to keep a webview process resident for the whole session —
        // `show_main` recreates the window on demand (tray click, or a second
        // exe launch caught by the single-instance plugin).
        .build(tauri::generate_context!())
        .expect("error while building ActivityTrack")
        .run(|_app_handle, event| {
            // Destroying the window now brings the window count to zero, which
            // by default would exit the whole process. This is a tray-resident
            // background agent — it must keep running (tracker thread + tray)
            // with no window open, so intercept the exit and stay alive.
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
