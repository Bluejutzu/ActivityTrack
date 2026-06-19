use serde::Deserialize;

use crate::paths::{app_dir, config_file, device_key_file};

// Values baked into the binary at build time by the release CI (via option_env!).
// Empty strings in dev builds where the env vars are not set.
const BUILD_CONVEX_URL: &str = match option_env!("ACTIVITYTRACK_CONVEX_URL") {
    Some(v) => v,
    None => "",
};
const BUILD_INGEST_KEY: &str = match option_env!("ACTIVITYTRACK_INGEST_KEY") {
    Some(v) => v,
    None => "",
};
const BUILD_CLERK_KEY: &str = match option_env!("ACTIVITYTRACK_CLERK_PUBLISHABLE_KEY") {
    Some(v) => v,
    None => "",
};

#[derive(Debug, Clone)]
pub struct Config {
    pub convex_url: String,
    /// Shared bootstrap secret for authenticating /agent/register calls.
    /// Stored as "ingestKey" in config.json for backward compatibility.
    pub bootstrap_key: String,
    /// Public Clerk browser key used by the tray UI. This is safe to bundle and
    /// is copied through the installer config so every installed device gets it.
    pub clerk_publishable_key: String,
    /// One-time enrollment code placed in config.json by IT. Consumed on
    /// first registration and no longer needed afterward.
    pub enrollment_code: Option<String>,
    pub poll_interval_ms: u64,
    pub idle_threshold_ms: u64,
    pub flush_interval_ms: u64,
    pub max_queue_size: usize,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileConfig {
    convex_url: Option<String>,
    #[serde(rename = "ingestKey")]
    bootstrap_key: Option<String>,
    clerk_publishable_key: Option<String>,
    enrollment_code: Option<String>,
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
            bootstrap_key: std::env::var("ACTIVITYTRACK_INGEST_KEY")
                .unwrap_or_else(|_| BUILD_INGEST_KEY.to_string()),
            clerk_publishable_key: std::env::var("ACTIVITYTRACK_CLERK_PUBLISHABLE_KEY")
                .or_else(|_| std::env::var("VITE_CLERK_PUBLISHABLE_KEY"))
                .unwrap_or_else(|_| BUILD_CLERK_KEY.to_string()),
            enrollment_code: std::env::var("ACTIVITYTRACK_ENROLLMENT_CODE").ok(),
            poll_interval_ms: 15_000,
            idle_threshold_ms: 60_000,
            flush_interval_ms: 30_000,
            max_queue_size: 5_000,
        }
    }
}

impl Config {
    /// True if the device can attempt enrollment (has code + bootstrap key).
    /// Whether it has actually enrolled (holds a device key) lives on AppState,
    /// since the key is acquired at runtime and is therefore mutable.
    pub fn can_register(&self) -> bool {
        !self.convex_url.is_empty()
            && !self.bootstrap_key.is_empty()
            && self.enrollment_code.is_some()
    }
}

/// Load config from the file in %ProgramData%. Missing files fall back to
/// env-derived defaults. The device key is loaded separately (see
/// `load_device_key`) because it's mutable at runtime, not part of Config.
pub fn load_config() -> Config {
    let mut cfg = Config::default();

    match std::fs::read_to_string(config_file()) {
        Ok(text) => {
            if let Ok(file) = serde_json::from_str::<FileConfig>(&text) {
                if let Some(v) = file.convex_url {
                    cfg.convex_url = v;
                }
                if let Some(v) = file.bootstrap_key {
                    cfg.bootstrap_key = v;
                }
                if let Some(v) = file.clerk_publishable_key {
                    cfg.clerk_publishable_key = v;
                }
                if let Some(v) = file.enrollment_code {
                    cfg.enrollment_code = Some(v);
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
            if !cfg.convex_url.is_empty() || !cfg.bootstrap_key.is_empty() {
                let _ = std::fs::create_dir_all(app_dir());
                let json = serde_json::json!({
                    "convexUrl": cfg.convex_url,
                    "ingestKey": cfg.bootstrap_key,
                    "clerkPublishableKey": cfg.clerk_publishable_key,
                });
                let _ = std::fs::write(config_file(), json.to_string());
            }
        }
    }

    cfg
}

/// Read the device key written after a successful enrollment, if present.
pub fn load_device_key() -> Option<String> {
    let key = std::fs::read_to_string(device_key_file()).ok()?;
    let key = key.trim().to_string();
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}
