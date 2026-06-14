use std::sync::Arc;

use tauri::State;

use crate::model::{AgentStatus, AGENT_VERSION};
use crate::sender;
use crate::state::AppState;

/// Read-only status snapshot for the debug UI. Always available (the data is
/// local); the UI itself decides whether to show it after the password gate.
#[tauri::command]
pub fn get_status(state: State<'_, Arc<AppState>>) -> AgentStatus {
    state.snapshot()
}

/// Verify the tray-login password against the dashboard-set hash, via the
/// keyed backend endpoint. Returns "ok" | "wrong" | "unset" | "network".
#[tauri::command]
pub fn verify_password(state: State<'_, Arc<AppState>>, password: String) -> String {
    sender::verify_password(
        &state.config.convex_url,
        state.device_key().as_deref(),
        &state.config.bootstrap_key,
        &password,
    )
}

/// Enroll this device with a one-time code from the dashboard.
/// Returns "ok" | "invalid_code" | "network".
/// No-ops (returns "ok") if already enrolled.
#[tauri::command]
pub fn enroll(state: State<'_, Arc<AppState>>, code: String) -> String {
    if state.device_key().is_some() {
        return "ok".into();
    }
    if state.config.convex_url.is_empty() || state.config.bootstrap_key.is_empty() {
        return "network".into();
    }
    match sender::register_device(
        &state.config.convex_url,
        &state.config.bootstrap_key,
        &code,
        &state.device_id,
        &state.hostname,
        &state.windows_user,
        AGENT_VERSION,
    ) {
        Ok(key) => {
            state.set_device_key(key);
            "ok".into()
        }
        Err(e) if e.starts_with("HTTP 404") || e.starts_with("HTTP 410") => {
            "invalid_code".into()
        }
        Err(_) => "network".into(),
    }
}
