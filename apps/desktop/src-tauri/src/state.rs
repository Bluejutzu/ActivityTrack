use std::collections::VecDeque;
use std::sync::Mutex;

use crate::config::Config;
use crate::model::{AgentStatus, UiSample, AGENT_VERSION};

/// Live, mutable tracker state shared between the background loop (writer) and
/// the `get_status` command (reader). Guarded by a Mutex; held only briefly.
pub struct Status {
    pub active: bool,
    pub idle_ms: u64,
    pub online: bool,
    pub last_sent_at: Option<u64>,
    pub last_error: Option<String>,
    pub queue_length: usize,
    pub last_samples: VecDeque<UiSample>,
}

impl Default for Status {
    fn default() -> Self {
        Status {
            active: false,
            idle_ms: 0,
            online: false,
            last_sent_at: None,
            last_error: None,
            queue_length: 0,
            last_samples: VecDeque::new(),
        }
    }
}

/// Process-wide application state managed by Tauri and shared with the tracker
/// thread (via Arc). Config + identity are immutable after startup.
pub struct AppState {
    pub config: Config,
    pub device_id: String,
    pub hostname: String,
    pub windows_user: String,
    pub status: Mutex<Status>,
}

impl AppState {
    pub fn snapshot(&self) -> AgentStatus {
        let s = self.status.lock().expect("status mutex poisoned");
        AgentStatus {
            device_id: self.device_id.clone(),
            hostname: self.hostname.clone(),
            windows_user: self.windows_user.clone(),
            active: s.active,
            idle_ms: s.idle_ms,
            online: s.online,
            queue_length: s.queue_length,
            last_sent_at: s.last_sent_at,
            last_error: s.last_error.clone(),
            convex_url: self.config.convex_url.clone(),
            configured: self.config.is_configured(),
            agent_version: AGENT_VERSION.to_string(),
            last_samples: s.last_samples.iter().cloned().collect(),
        }
    }
}
