use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::Mutex;

use crate::host;
use crate::paths::{app_dir, log_file, log_file_rotated};

/// Cap the log at ~512 KB. On exceed, the current file is rotated to
/// `agent.log.1` (one generation kept), so the log can never grow unbounded —
/// the same bounded-disk guarantee the queue already has.
const MAX_LOG_BYTES: u64 = 512 * 1024;

/// Serialize writes from the tracker thread and any command handlers.
static LOG_LOCK: Mutex<()> = Mutex::new(());

/// Append a line to %ProgramData%\ActivityTrack\agent.log. Best-effort by design:
/// logging must never panic or cascade, so every IO error is swallowed. The
/// timestamp is epoch-ms (dependency-free); pair it with the dashboard event log
/// for human-readable context.
pub fn write(level: &str, code: &str, message: &str) {
    // Recover from a poisoned lock rather than panic — a logging failure must not
    // take down the agent.
    let _guard = LOG_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let _ = fs::create_dir_all(app_dir());
    let path = log_file();

    if let Ok(meta) = fs::metadata(&path) {
        if meta.len() > MAX_LOG_BYTES {
            let _ = fs::rename(&path, log_file_rotated());
        }
    }

    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let ts = host::now_ms();
        let _ = writeln!(f, "{ts} [{level}] {code}: {message}");
    }
}
