use serde::Deserialize;

use crate::paths::config_file;

/// Agent configuration. A `config.json` in %ProgramData%\ActivityTrack supplies
/// the per-machine Convex URL + ingest key (dropped by the installer); the
/// timing knobs have sensible defaults. Environment variables provide a
/// fallback for the secrets during local development.
#[derive(Debug, Clone)]
pub struct Config {
    pub convex_url: String,
    pub ingest_key: String,
    pub poll_interval_ms: u64,
    pub idle_threshold_ms: u64,
    pub flush_interval_ms: u64,
    pub max_queue_size: usize,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileConfig {
    convex_url: Option<String>,
    ingest_key: Option<String>,
    poll_interval_ms: Option<u64>,
    idle_threshold_ms: Option<u64>,
    flush_interval_ms: Option<u64>,
    max_queue_size: Option<usize>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            convex_url: std::env::var("ACTIVITYTRACK_CONVEX_URL").unwrap_or_default(),
            ingest_key: std::env::var("ACTIVITYTRACK_INGEST_KEY").unwrap_or_default(),
            poll_interval_ms: 15_000,
            idle_threshold_ms: 60_000,
            flush_interval_ms: 30_000,
            max_queue_size: 5_000,
        }
    }
}

impl Config {
    /// True once we have somewhere to send and a key to authenticate with.
    pub fn is_configured(&self) -> bool {
        !self.convex_url.is_empty() && !self.ingest_key.is_empty()
    }
}

/// Load config: file in %ProgramData% overrides env-derived defaults. A missing
/// or malformed file falls back to defaults rather than crashing the agent.
pub fn load_config() -> Config {
    let mut cfg = Config::default();
    let path = config_file();
    let Ok(text) = std::fs::read_to_string(&path) else {
        return cfg;
    };
    let Ok(file) = serde_json::from_str::<FileConfig>(&text) else {
        return cfg;
    };
    if let Some(v) = file.convex_url {
        cfg.convex_url = v;
    }
    if let Some(v) = file.ingest_key {
        cfg.ingest_key = v;
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
    cfg
}
