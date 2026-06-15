use std::sync::Arc;

use tauri::State;

use crate::model::{AgentStatus, Diagnostics, Outcome, AGENT_VERSION};
use crate::paths::config_file;
use crate::sender;
use crate::state::AppState;

/// Read-only status snapshot for the debug UI. Always available (the data is
/// local); the UI itself decides whether to show it after the password gate.
#[tauri::command]
pub fn get_status(state: State<'_, Arc<AppState>>) -> AgentStatus {
    state.snapshot()
}

/// Verify the tray-login password against the dashboard-set hash, via the keyed
/// backend endpoint. Returns a structured `Outcome` (status + diagnostic detail)
/// — see `sender::verify_password` for the status codes.
#[tauri::command]
pub fn verify_password(state: State<'_, Arc<AppState>>, password: String) -> Outcome {
    sender::verify_password(
        &state.config.convex_url,
        state.device_key().as_deref(),
        &state.config.bootstrap_key,
        &password,
    )
}

/// Enroll this device with a one-time code from the dashboard. Returns a
/// structured `Outcome`:
/// - `ok`              — enrolled (or already enrolled)
/// - `invalid_code`   — code invalid, used, or expired (404/410)
/// - `not_configured` — missing Convex URL or bootstrap key
/// - `server`         — server reached but returned an unexpected status
/// - `network`        — transport failure
#[tauri::command]
pub fn enroll(state: State<'_, Arc<AppState>>, code: String) -> Outcome {
    if state.device_key().is_some() {
        return Outcome::of("ok");
    }
    if state.config.convex_url.is_empty() {
        return Outcome::with(
            "not_configured",
            "Convex URL is not set (config.json \"convexUrl\" or the \
             ACTIVITYTRACK_CONVEX_URL environment variable).",
        );
    }
    if state.config.bootstrap_key.is_empty() {
        return Outcome::with(
            "not_configured",
            "Bootstrap key is not set (config.json \"ingestKey\" or the \
             ACTIVITYTRACK_INGEST_KEY environment variable).",
        );
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
            Outcome::of("ok")
        }
        Err(e) if e.starts_with("HTTP 404") || e.starts_with("HTTP 410") => {
            Outcome::with("invalid_code", e)
        }
        Err(e) if e.starts_with("HTTP ") => Outcome::with("server", e),
        Err(e) => Outcome::with("network", e),
    }
}

/// Connectivity/configuration snapshot for the login screen. Always available
/// (reads only local config + identity), so a misconfigured machine can be
/// diagnosed without first unlocking the tool.
#[tauri::command]
pub fn get_diagnostics(state: State<'_, Arc<AppState>>) -> Diagnostics {
    let path = config_file();
    Diagnostics {
        convex_url: state.config.convex_url.clone(),
        config_file: path.display().to_string(),
        config_present: path.exists(),
        has_convex_url: !state.config.convex_url.is_empty(),
        has_bootstrap_key: !state.config.bootstrap_key.is_empty(),
        enrolled: state.device_key().is_some(),
        configured: state.is_configured(),
    }
}
