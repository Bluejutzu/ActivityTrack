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

/// One-time pairing nonce, generated locally before the device is approved and
/// deleted once it has claimed its token. Lets only this machine claim the token
/// for its `deviceId` (the server stores only the nonce's hash).
pub fn pair_nonce_file() -> PathBuf {
    app_dir().join("pair.nonce")
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

/// Tighten a secret file's ACL to SYSTEM, Administrators, and the account that
/// wrote it (the caller — resolved via `whoami` so the exact principal string
/// is always correct for `icacls`, regardless of local/domain account naming).
/// Applied to `device.key` and `pair.nonce`: by default, files created under
/// `%ProgramData%\ActivityTrack` inherit that folder's ACL, which grants the
/// local `Users` group read access — i.e. *any* other locally logged-in
/// account on the machine could read this device's bearer token or pairing
/// nonce and reuse/exfiltrate it. `config.json` and `queue.jsonl` hold no
/// secrets, so they're left with the default (shared) permissions to preserve
/// this app's existing multi-user-per-machine support.
///
/// Trade-off: if a *different* Windows account later runs the tracker on this
/// same machine, it won't be able to read a device.key written under the
/// first account — it falls back to re-pairing, which the existing pairing
/// flow already surfaces as a clear, actionable error
/// (`tracker.pair_failed` / "already claimed") rather than failing silently.
/// Best-effort by design, like the rest of this module's file I/O: a failure
/// here is swallowed, never panics, and never blocks writing the file itself.
#[cfg(windows)]
pub fn harden_secret_file(path: &std::path::Path) {
    use std::process::Command;

    let Ok(who) = Command::new("whoami").output() else {
        return;
    };
    if !who.status.success() {
        return;
    }
    let principal = String::from_utf8_lossy(&who.stdout).trim().to_string();
    if principal.is_empty() {
        return;
    }

    let _ = Command::new("icacls")
        .arg(path.as_os_str())
        .arg("/inheritance:r")
        .arg("/grant:r")
        .arg("*S-1-5-18:F") // SYSTEM
        .arg("*S-1-5-32-544:F") // Administrators
        .arg(format!("{principal}:F"))
        .output();
}

#[cfg(not(windows))]
pub fn harden_secret_file(_path: &std::path::Path) {}
