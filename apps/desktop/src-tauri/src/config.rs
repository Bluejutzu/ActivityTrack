use serde::Deserialize;

use crate::paths::{config_file, device_key_file};

#[derive(Debug, Clone)]
pub struct Config {
    pub convex_url: String,
    /// Shared bootstrap secret for authenticating /agent/register calls.
    /// Stored as "ingestKey" in config.json for backward compatibility.
    pub bootstrap_key: String,
    /// One-time enrollment code placed in config.json by IT. Consumed on
    /// first registration and no longer needed afterward.
    pub enrollment_code: Option<String>,
    /// Per-device key issued by the backend on enrollment. Loaded from the
    /// device.key file (written after first successful registration).
    pub device_key: Option<String>,
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
    enrollment_code: Option<String>,
    poll_interval_ms: Option<u64>,
    idle_threshold_ms: Option<u64>,
    flush_interval_ms: Option<u64>,
    max_queue_size: Option<usize>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            convex_url: std::env::var("ACTIVITYTRACK_CONVEX_URL").unwrap_or_default(),
            bootstrap_key: std::env::var("ACTIVITYTRACK_INGEST_KEY").unwrap_or_default(),
            enrollment_code: std::env::var("ACTIVITYTRACK_ENROLLMENT_CODE").ok(),
            device_key: None,
            poll_interval_ms: 15_000,
            idle_threshold_ms: 60_000,
            flush_interval_ms: 30_000,
            max_queue_size: 5_000,
        }
    }
}

impl Config {
    /// True if the device has a key and can send samples.
    pub fn can_send(&self) -> bool {
        !self.convex_url.is_empty() && self.device_key.is_some()
    }

    /// True if the device can attempt enrollment (has code + bootstrap key).
    pub fn can_register(&self) -> bool {
        !self.convex_url.is_empty()
            && !self.bootstrap_key.is_empty()
            && self.enrollment_code.is_some()
    }

    /// True if the config is usable (either already enrolled or can enroll).
    pub fn is_configured(&self) -> bool {
        self.can_send() || self.can_register()
    }
}

/// Load config from the file in %ProgramData%, then load the device key from
/// its own file. Missing files fall back to env-derived defaults.
pub fn load_config() -> Config {
    let mut cfg = Config::default();

    // Load config.json
    if let Ok(text) = std::fs::read_to_string(config_file()) {
        if let Ok(file) = serde_json::from_str::<FileConfig>(&text) {
            if let Some(v) = file.convex_url {
                cfg.convex_url = v;
            }
            if let Some(v) = file.bootstrap_key {
                cfg.bootstrap_key = v;
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

    // Load device key from its own file (written after first enrollment)
    if let Ok(key) = std::fs::read_to_string(device_key_file()) {
        let key = key.trim().to_string();
        if !key.is_empty() {
            cfg.device_key = Some(key);
        }
    }

    cfg
}
