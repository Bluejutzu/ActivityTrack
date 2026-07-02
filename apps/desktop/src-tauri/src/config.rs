use serde::Deserialize;

use crate::paths::{app_dir, config_file, device_key_file};

// Values baked into the binary at build time by the release CI (via option_env!).
// Empty strings in dev builds where the env vars are not set. Both are plain
// URLs — there are no secrets in the installed config anymore (the device's only
// credential is the per-device token it earns at approval; see state.rs).
const BUILD_CONVEX_URL: &str = match option_env!("ACTIVITYTRACK_CONVEX_URL") {
    Some(v) => v,
    None => "",
};
const BUILD_API_URL: &str = match option_env!("ACTIVITYTRACK_API_URL") {
    Some(v) => v,
    None => "",
};

#[derive(Debug, Clone)]
pub struct Config {
    /// Convex deployment HTTP-actions origin (`*.convex.site`). Used for the
    /// device-token-authenticated endpoints: /ingest, /agent/event,
    /// /agent/verify-password.
    pub convex_url: String,
    /// Dashboard API origin (https://api.advantisgroup.de). Used for the pairing
    /// endpoints the device hits without any credential: /agent/register and
    /// /agent/poll.
    pub api_url: String,
    pub poll_interval_ms: u64,
    pub idle_threshold_ms: u64,
    pub flush_interval_ms: u64,
    pub max_queue_size: usize,
    /// Whether to show the tray icon. Defaults to `false` so the agent is
    /// fully invisible in normal operation (employees are informed of
    /// monitoring out-of-band; this just avoids a persistent visual reminder).
    /// IT can set `"showTrayIcon": true` in config.json on a machine to get
    /// the Open/Quit tray menu back for local debugging.
    pub show_tray_icon: bool,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileConfig {
    convex_url: Option<String>,
    api_url: Option<String>,
    poll_interval_ms: Option<u64>,
    idle_threshold_ms: Option<u64>,
    flush_interval_ms: Option<u64>,
    max_queue_size: Option<usize>,
    show_tray_icon: Option<bool>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            convex_url: std::env::var("ACTIVITYTRACK_CONVEX_URL")
                .unwrap_or_else(|_| BUILD_CONVEX_URL.to_string()),
            api_url: std::env::var("ACTIVITYTRACK_API_URL")
                .unwrap_or_else(|_| BUILD_API_URL.to_string()),
            poll_interval_ms: 15_000,
            idle_threshold_ms: 60_000,
            flush_interval_ms: 30_000,
            max_queue_size: 5_000,
            show_tray_icon: false,
        }
    }
}

impl Config {
    /// True if the device can attempt pairing (knows where the dashboard API is).
    /// Whether it has actually paired (holds a device token) lives on AppState,
    /// since the token is acquired at runtime and is therefore mutable.
    pub fn can_pair(&self) -> bool {
        !self.api_url.is_empty()
    }
}

/// Load config from the file in %ProgramData%, then reconcile it with this
/// build's baked-in `convexUrl`/`apiUrl` and persist the result.
///
/// Precedence for `convex_url`/`api_url`: the `ACTIVITYTRACK_CONVEX_URL`/
/// `_API_URL` env vars (local dev override) win first; otherwise a non-empty
/// build-time value (baked in by release CI from the repo secret/var) always
/// wins over whatever is already in `config.json`; only when neither an env
/// var nor a build value is present does the file's value apply. This exists
/// because installs/updates alone can't keep `config.json` in sync: the NSIS
/// installer only writes it when the file is missing, and neither an
/// auto-update nor an uninstall touches `%ProgramData%\ActivityTrack` — so
/// without this, a device that shipped with an old baked URL would keep it
/// forever even after the CI secret changes and a new version is installed.
/// All other fields (poll/idle/flush intervals, queue size, tray icon) stay
/// freely overridable per machine via `config.json`, unaffected by this.
///
/// The device token is loaded separately (see `load_device_key`) because it's
/// mutable at runtime, not part of Config.
pub fn load_config() -> Config {
    let mut cfg = Config::default();
    let convex_env_set = std::env::var("ACTIVITYTRACK_CONVEX_URL").is_ok();
    let api_env_set = std::env::var("ACTIVITYTRACK_API_URL").is_ok();

    let existing_text = std::fs::read_to_string(config_file()).ok();
    let file: FileConfig = existing_text
        .as_deref()
        .and_then(|text| serde_json::from_str(text).ok())
        .unwrap_or_default();

    // A build-baked (or env-overridden) URL always wins over the file's —
    // see the precedence note above. Only reachable here when neither is set.
    if let Some(v) = file.convex_url {
        if !convex_env_set && BUILD_CONVEX_URL.is_empty() {
            cfg.convex_url = v;
        }
    }
    if let Some(v) = file.api_url {
        if !api_env_set && BUILD_API_URL.is_empty() {
            cfg.api_url = v;
        }
    }
    if let Some(v) = file.poll_interval_ms {
        cfg.poll_interval_ms = v;
    }
    if let Some(v) = file.idle_threshold_ms {
        cfg.idle_threshold_ms = v;
    }
    if let Some(v) = file.flush_interval_ms {
        cfg.flush_interval_ms = v;
    }
    if let Some(v) = file.max_queue_size {
        cfg.max_queue_size = v;
    }
    if let Some(v) = file.show_tray_icon {
        cfg.show_tray_icon = v;
    }

    persist_config(&cfg, existing_text.as_deref());
    cfg
}

/// Write the resolved config back to disk so `config.json` always reflects
/// what's actually in effect (and so the URL-resync above survives a restart
/// without re-deriving it every time). No-ops when nothing would change, and
/// — matching the previous behavior — never creates the file for a fully
/// unconfigured dev build (no baked/env/file URLs at all), to avoid a noisy
/// empty file on every local `pnpm tauri:dev` run.
fn persist_config(cfg: &Config, existing_text: Option<&str>) {
    if existing_text.is_none() && cfg.convex_url.is_empty() && cfg.api_url.is_empty() {
        return;
    }

    let resolved = serde_json::json!({
        "convexUrl": cfg.convex_url,
        "apiUrl": cfg.api_url,
        "pollIntervalMs": cfg.poll_interval_ms,
        "idleThresholdMs": cfg.idle_threshold_ms,
        "flushIntervalMs": cfg.flush_interval_ms,
        "maxQueueSize": cfg.max_queue_size,
        "showTrayIcon": cfg.show_tray_icon,
    });

    // Compare parsed values, not raw text, so re-serializing with different
    // whitespace/key order doesn't cause a rewrite (and a log/AV-scan trigger)
    // on every single startup.
    let unchanged = existing_text
        .and_then(|text| serde_json::from_str::<serde_json::Value>(text).ok())
        .is_some_and(|existing| existing == resolved);
    if unchanged {
        return;
    }

    let _ = std::fs::create_dir_all(app_dir());
    let _ = std::fs::write(config_file(), resolved.to_string());
}

/// Read the device token written after a successful pairing, if present.
pub fn load_device_key() -> Option<String> {
    let key = std::fs::read_to_string(device_key_file()).ok()?;
    let key = key.trim().to_string();
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}
