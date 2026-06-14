use std::sync::Arc;

use tauri::State;

use crate::model::AgentStatus;
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
