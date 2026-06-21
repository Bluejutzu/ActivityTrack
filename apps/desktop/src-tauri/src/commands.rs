use std::sync::Arc;

use tauri::State;

use crate::model::{AgentStatus, Diagnostics, Outcome};
use crate::paths::config_file;
use crate::sender;
use crate::state::AppState;

/// Read-only status snapshot for the debug UI. Always available (the data is
/// local); the UI shows the pairing screen until the device has a token, then
/// gates the rest behind the password.
#[tauri::command]
pub fn get_status(state: State<'_, Arc<AppState>>) -> AgentStatus {
    state.snapshot()
}

/// Verify the tray-login password against the dashboard-set hash, via the
/// device-token-authenticated backend endpoint. Returns a structured `Outcome`
/// (status + diagnostic detail) — see `sender::verify_password` for the codes.
/// Only meaningful once the device is paired (it needs its token to authenticate).
#[tauri::command]
pub fn verify_password(state: State<'_, Arc<AppState>>, password: String) -> Outcome {
    sender::verify_password(
        &state.config.convex_url,
        state.device_key().as_deref(),
        &password,
    )
}

/// Connectivity/configuration snapshot for the pairing/login screen. Always
/// available (reads only local config + identity), so a misconfigured machine
/// can be diagnosed without first unlocking the tool.
#[tauri::command]
pub fn get_diagnostics(state: State<'_, Arc<AppState>>) -> Diagnostics {
    let path = config_file();
    Diagnostics {
        convex_url: state.config.convex_url.clone(),
        api_url: state.config.api_url.clone(),
        config_file: path.display().to_string(),
        config_present: path.exists(),
        has_convex_url: !state.config.convex_url.is_empty(),
        has_api_url: !state.config.api_url.is_empty(),
        enrolled: state.device_key().is_some(),
        configured: state.is_configured(),
    }
}
