use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use uuid::Uuid;

use crate::config::Config;
use crate::host;
use crate::model::{AgentStatus, UiError, UiSample, AGENT_VERSION};
use crate::paths::{app_dir, device_key_file, harden_secret_file, pair_nonce_file};
use crate::sender;

/// Keep the last N local errors for the debug UI.
const RECENT_ERRORS_MAX: usize = 25;
/// Don't report the SAME code to the backend more than once per this interval.
/// Server-side dedup collapses the rest; this just bounds outbound chatter
/// while still letting distinct problems through independently.
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
    /// Pairing sub-state shown on the pre-token pairing screen — see
    /// `AgentStatus.pairing`. Updated by the tracker's pairing loop.
    pub pairing: String,
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
            pairing: "unconfigured".to_string(),
            last_samples: VecDeque::new(),
            recent_errors: VecDeque::new(),
        }
    }
}

/// Process-wide application state managed by Tauri and shared with the tracker
/// thread (via Arc). Config + identity are immutable after startup; the device
/// key is acquired at runtime (enrollment happens in the background), so it
/// lives behind a Mutex.
pub struct AppState {
    pub config: Config,
    pub device_id: String,
    pub hostname: String,
    pub windows_user: String,
    pub status: Mutex<Status>,
    /// Per-device token issued by the backend at approval; None until paired.
    device_key: Mutex<Option<String>>,
    /// One-time pairing nonce, generated/persisted lazily before approval and
    /// cleared once the token is claimed. Cached here so register + poll present
    /// the same value across a session.
    pair_nonce: Mutex<Option<String>>,
    /// Last time we reported each event code to the backend (rate-limit gate).
    last_report: Mutex<HashMap<String, Instant>>,
}

impl AppState {
    pub fn new(
        config: Config,
        device_id: String,
        hostname: String,
        windows_user: String,
        device_key: Option<String>,
    ) -> Self {
        AppState {
            config,
            device_id,
            hostname,
            windows_user,
            status: Mutex::new(Status::default()),
            device_key: Mutex::new(device_key),
            pair_nonce: Mutex::new(None),
            last_report: Mutex::new(HashMap::new()),
        }
    }

    /// The current device token, if paired.
    pub fn device_key(&self) -> Option<String> {
        self.device_key
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    /// This device's one-time pairing nonce, loaded from disk or generated (and
    /// persisted) on first use so it survives a restart while awaiting approval.
    pub fn pairing_nonce(&self) -> String {
        {
            let cached = self.pair_nonce.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(n) = cached.as_ref() {
                return n.clone();
            }
        }
        let nonce = std::fs::read_to_string(pair_nonce_file())
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                // ~244 bits of randomness; the server only ever stores its hash.
                let n = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
                let _ = std::fs::create_dir_all(app_dir());
                let _ = std::fs::write(pair_nonce_file(), &n);
                harden_secret_file(&pair_nonce_file());
                n
            });
        *self.pair_nonce.lock().unwrap_or_else(|e| e.into_inner()) = Some(nonce.clone());
        nonce
    }

    /// Drop the pairing nonce (in memory + on disk) once a token is claimed.
    pub fn clear_pairing_nonce(&self) {
        *self.pair_nonce.lock().unwrap_or_else(|e| e.into_inner()) = None;
        let _ = std::fs::remove_file(pair_nonce_file());
    }

    /// Forget the device token (memory + disk) after the server rejects it — a
    /// revoked/disabled device then re-enters the pairing flow on the next tick.
    pub fn clear_device_key(&self) {
        *self.device_key.lock().unwrap_or_else(|e| e.into_inner()) = None;
        let _ = std::fs::remove_file(device_key_file());
    }

    /// Set the pairing sub-state shown on the pairing screen.
    pub fn set_pairing(&self, state: &str) {
        let mut s = self.status.lock().unwrap_or_else(|e| e.into_inner());
        s.pairing = state.to_string();
    }

    /// Store a freshly-issued device token (in memory) and persist it to disk.
    /// In-memory is set first so `can_send` flips immediately; a write failure
    /// is surfaced as a (reportable) warning rather than lost.
    pub fn set_device_key(&self, key: String) {
        {
            let mut k = self.device_key.lock().unwrap_or_else(|e| e.into_inner());
            *k = Some(key.clone());
        }
        let _ = std::fs::create_dir_all(app_dir());
        match std::fs::write(device_key_file(), &key) {
            Ok(()) => harden_secret_file(&device_key_file()),
            Err(e) => {
                let msg = format!(
                    "Paired, but the device token could not be saved to disk ({e}); \
                     re-pairing will be required after restart."
                );
                self.push_error("tracker.queue_io", msg.clone());
                self.report_event("warning", "tracker.queue_io", &msg);
            }
        }
    }

    /// True if the device is paired and configured to send samples.
    pub fn can_send(&self) -> bool {
        !self.config.convex_url.is_empty() && self.device_key().is_some()
    }

    /// True if the config is usable (either already paired or able to pair).
    pub fn is_configured(&self) -> bool {
        self.can_send() || self.config.can_pair()
    }

    /// Record a local error so it surfaces in the tray UI. Never swallowed: the
    /// most recent message stays in `last_error`, and a bounded history is kept
    /// in `recent_errors`.
    pub fn push_error(&self, code: &str, message: String) {
        crate::log::write("error", code, &message);
        let mut s = self.status.lock().unwrap_or_else(|e| e.into_inner());
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
    /// device key authenticates the call) and is rate-limited PER CODE, so a
    /// recurring `send_failed` can't muffle a distinct `queue_io`. Failures here
    /// are intentionally ignored — reporting must never cascade.
    pub fn report_event(&self, severity: &str, code: &str, message: &str) {
        // Persist locally regardless of whether we can reach the backend below.
        crate::log::write(severity, code, message);
        let device_key = match self.device_key() {
            Some(k) if !self.config.convex_url.is_empty() => k,
            _ => return,
        };
        {
            let mut last = self.last_report.lock().unwrap_or_else(|e| e.into_inner());
            let now = Instant::now();
            if let Some(prev) = last.get(code) {
                if now.duration_since(*prev) < BACKEND_REPORT_INTERVAL {
                    return;
                }
            }
            last.insert(code.to_string(), now);
        }
        let _ = sender::report_event(
            &self.config.convex_url,
            &device_key,
            severity,
            code,
            message,
            &self.hostname,
        );
    }

    pub fn snapshot(&self) -> AgentStatus {
        let enrolled = self.device_key().is_some();
        let s = self.status.lock().unwrap_or_else(|e| e.into_inner());
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
            configured: self.is_configured(),
            enrolled,
            pairing: if enrolled {
                "paired".to_string()
            } else {
                s.pairing.clone()
            },
            agent_version: AGENT_VERSION.to_string(),
            last_samples: s.last_samples.iter().cloned().collect(),
            recent_errors: s.recent_errors.iter().cloned().collect(),
        }
    }
}
