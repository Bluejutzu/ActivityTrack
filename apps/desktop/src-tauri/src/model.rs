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
}

pub const AGENT_VERSION: &str = env!("CARGO_PKG_VERSION");
