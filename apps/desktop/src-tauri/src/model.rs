use serde::{Deserialize, Serialize};

/// The wire contract sent to Convex `/ingest`. Field names mirror
/// `packages/shared` `activitySampleSchema` exactly (camelCase) so the
/// server's zod validation accepts it. The agent does no validation itself.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySample {
    pub device_id: String,
    pub windows_user: String,
    pub hostname: String,
    pub idle_ms: u64,
    pub active: bool,
    pub captured_at: u64,
    pub tz_offset_minutes: i32,
    pub agent_version: String,
    pub platform: String,
}

/// A compact sample shown in the debug UI's "recently sent" table.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiSample {
    pub active: bool,
    pub idle_ms: u64,
    pub captured_at: u64,
}

/// A recorded local error, shown in the debug UI so a technician on the machine
/// can see *what* failed and when — not just the most recent message.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiError {
    pub at: u64,
    pub code: String,
    pub message: String,
}

/// Snapshot returned to the tray UI by the `get_status` command.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub device_id: String,
    pub hostname: String,
    pub windows_user: String,
    pub active: bool,
    pub idle_ms: u64,
    pub online: bool,
    pub queue_length: usize,
    pub last_sent_at: Option<u64>,
    pub last_error: Option<String>,
    pub convex_url: String,
    pub configured: bool,
    pub enrolled: bool,
    pub agent_version: String,
    pub last_samples: Vec<UiSample>,
    pub recent_errors: Vec<UiError>,
}

/// Result of a command that talks to the backend (password check, enrollment).
/// `status` is a stable machine code the UI maps to a localized message; `detail`
/// carries the real underlying reason (HTTP status + body, transport error, or
/// which config/credential is missing) so a technician can debug on the machine
/// without guessing. This is the desktop analogue of the web app's structured
/// `ConvexError { code, message }`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub status: String,
    pub detail: Option<String>,
}

impl Outcome {
    /// A bare status with no extra detail (e.g. "ok", "wrong").
    pub fn of(status: &str) -> Self {
        Outcome {
            status: status.to_string(),
            detail: None,
        }
    }

    /// A status with a human-readable diagnostic detail.
    pub fn with(status: &str, detail: impl Into<String>) -> Self {
        Outcome {
            status: status.to_string(),
            detail: Some(detail.into()),
        }
    }
}

/// Connectivity/configuration snapshot, available *without* unlocking the tool.
/// Surfaced on the login screen so a misconfigured machine (missing Convex URL,
/// missing access key, not enrolled) is debuggable up front instead of hiding
/// behind a generic "server unreachable" message.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub convex_url: String,
    pub config_file: String,
    pub config_present: bool,
    pub has_convex_url: bool,
    pub has_bootstrap_key: bool,
    pub enrolled: bool,
    pub configured: bool,
}

pub const AGENT_VERSION: &str = env!("CARGO_PKG_VERSION");
