use std::path::PathBuf;

/// All persistent state lives under %ProgramData%\ActivityTrack so it is shared
/// across every Windows user on the device and survives app updates. On
/// non-Windows (dev) we fall back to a local data dir so the app still runs.
pub fn app_dir() -> PathBuf {
    #[cfg(windows)]
    {
        let base = std::env::var_os("PROGRAMDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("C:\\ProgramData"));
        base.join("ActivityTrack")
    }
    #[cfg(not(windows))]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ActivityTrack")
    }
}

pub fn device_id_file() -> PathBuf {
    app_dir().join("device-id")
}

pub fn config_file() -> PathBuf {
    app_dir().join("config.json")
}

pub fn queue_file() -> PathBuf {
    app_dir().join("queue.jsonl")
}

pub fn device_key_file() -> PathBuf {
    app_dir().join("device.key")
}

/// Size-capped operational log. A hidden tray app has nowhere to print to, so
/// errors are also persisted here for IT to inspect after the fact.
pub fn log_file() -> PathBuf {
    app_dir().join("agent.log")
}

/// Single rotated generation of the log (the previous file, kept on rollover).
pub fn log_file_rotated() -> PathBuf {
    app_dir().join("agent.log.1")
}
