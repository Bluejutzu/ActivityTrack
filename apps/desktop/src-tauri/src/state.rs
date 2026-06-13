use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::config::Config;
use crate::host;
use crate::model::{AgentStatus, UiError, UiSample, AGENT_VERSION};
use crate::sender;

/// Keep the last N local errors for the debug UI.
const RECENT_ERRORS_MAX: usize = 25;
/// Don't report to the backend more than once per this interval (per device).
/// Server-side dedup collapses the rest; this just bounds outbound chatter.
const BACKEND_REPORT_INTERVAL: Duration = Duration::from_secs(300);

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
    pub recent_errors: VecDeque<UiError>,
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
            recent_errors: VecDeque::new(),
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
    /// Last time we reported any event to the backend (rate-limit gate).
    last_report: Mutex<Option<Instant>>,
}

impl AppState {
    pub fn new(
        config: Config,
        device_id: String,
        hostname: String,
        windows_user: String,
    ) -> Self {
        AppState {
            config,
            device_id,
            hostname,
            windows_user,
            status: Mutex::new(Status::default()),
            last_report: Mutex::new(None),
        }
    }

    /// Record a local error so it surfaces in the tray UI. Never swallowed: the
    /// most recent message stays in `last_error`, and a bounded history is kept
    /// in `recent_errors`.
    pub fn push_error(&self, code: &str, message: String) {
        let mut s = self.status.lock().expect("status mutex poisoned");
        s.last_error = Some(message.clone());
        s.recent_errors.push_front(UiError {
            at: host::now_ms(),
            code: code.to_string(),
            message,
        });
        while s.recent_errors.len() > RECENT_ERRORS_MAX {
            s.recent_errors.pop_back();
        }
    }

    /// Best-effort report of a local problem to the central event log, so IT
    /// sees it on the dashboard's System Health page. Requires enrollment (the
    /// device key authenticates the call) and is rate-limited; failures here are
    /// intentionally ignored — reporting must never cascade.
    pub fn report_event(&self, severity: &str, code: &str, message: &str) {
        if !self.config.can_send() {
            return;
        }
        {
            let mut last = self.last_report.lock().expect("report mutex poisoned");
            let now = Instant::now();
            if let Some(prev) = *last {
                if now.duration_since(prev) < BACKEND_REPORT_INTERVAL {
                    return;
                }
            }
            *last = Some(now);
        }
        let _ = sender::report_event(&self.config, severity, code, message, &self.hostname);
    }

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
            enrolled: self.config.device_key.is_some(),
            agent_version: AGENT_VERSION.to_string(),
            last_samples: s.last_samples.iter().cloned().collect(),
            recent_errors: s.recent_errors.iter().cloned().collect(),
        }
    }
}
