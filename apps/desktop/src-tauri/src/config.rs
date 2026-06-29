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

/// Load config from the file in %ProgramData%. Missing files fall back to
/// env-derived defaults. The device token is loaded separately (see
/// `load_device_key`) because it's mutable at runtime, not part of Config.
pub fn load_config() -> Config {
    let mut cfg = Config::default();

    match std::fs::read_to_string(config_file()) {
        Ok(text) => {
            if let Ok(file) = serde_json::from_str::<FileConfig>(&text) {
                if let Some(v) = file.convex_url {
                    cfg.convex_url = v;
                }
                if let Some(v) = file.api_url {
                    cfg.api_url = v;
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
            }
        }
        Err(_) => {
            // Config file missing — write a template so the NSIS hook failure
            // doesn't leave the app unconfigured. Only write if we have baked
            // values (release builds); dev builds skip this to avoid a noisy
            // empty file.
            if !cfg.convex_url.is_empty() || !cfg.api_url.is_empty() {
                let _ = std::fs::create_dir_all(app_dir());
                let json = serde_json::json!({
                    "convexUrl": cfg.convex_url,
                    "apiUrl": cfg.api_url,
                });
                let _ = std::fs::write(config_file(), json.to_string());
            }
        }
    }

    cfg
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
