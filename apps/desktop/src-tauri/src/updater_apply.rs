#[cfg(windows)]
use crate::paths::{harden_secret_file, pending_update_file};

#[cfg(windows)]
const ZIP_MAGIC: [u8; 4] = [0x50, 0x4B, 0x03, 0x04];

/// Unwraps the `.exe` tauri-bundler zips up for the Windows NSIS updater
/// artifact (see `tauri_plugin_updater::Update`'s own doc comment on its
/// private `extract()` — `[name]-setup.exe.zip` wrapping `[name]-setup.exe`).
/// Falls back to treating `bytes` as the raw installer, for local/dev
/// artifacts that aren't zipped.
#[cfg(windows)]
fn extract_installer_bytes(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.get(0..4) != Some(&ZIP_MAGIC) {
        return Ok(bytes.to_vec());
    }
    let mut archive =
        zip::ZipArchive::new(std::io::Cursor::new(bytes)).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.name().ends_with(".exe") {
            let mut out = Vec::with_capacity(entry.size() as usize);
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
            return Ok(out);
        }
    }
    Err("no .exe found inside updater zip".into())
}

/// Stages a verified update package (the bytes `Update::download` already
/// minisign-checked against tauri.conf.json's `updater.pubkey`) at the fixed
/// path the `ActivityTrackUpdate` scheduled task always runs, then triggers
/// that task.
///
/// This replaces `Update::install`, which launches the installer via
/// `ShellExecuteW` — that always raises a UAC consent prompt, because the
/// app is installed `perMachine` (needed so the HKLM autostart Run key
/// covers every Windows user on the machine, not just whoever installed it).
/// With the tray icon hidden by default, that prompt has no visible owner
/// and can sit unnoticed indefinitely. `ActivityTrackUpdate` is registered
/// once at install time to run as SYSTEM (see `installer.nsh`), so running
/// it needs no elevation and raises no prompt.
///
/// Security note: the task's action is a FIXED command pinned to this exact
/// path at install time — this function never reconfigures it. Letting an
/// unprivileged process control what a SYSTEM task executes would itself be
/// a local-privilege-escalation hole; the only thing this function controls
/// is *what bytes* land at that fixed path, and those are already
/// signature-verified by `Update::download` before reaching here.
#[cfg(windows)]
pub fn stage_and_run(bytes: &[u8]) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    // Suppresses the console flash `schtasks.exe` would otherwise cause on a
    // GUI app with no console of its own (same reasoning as
    // paths::harden_secret_file's use of this flag).
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let installer_bytes = extract_installer_bytes(bytes)?;

    let target = pending_update_file();
    if let Some(dir) = target.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&target, &installer_bytes).map_err(|e| e.to_string())?;
    harden_secret_file(&target);

    let status = Command::new("schtasks.exe")
        .args(["/Run", "/TN", "ActivityTrackUpdate"])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err(format!("schtasks /Run exited with {status}"));
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn stage_and_run(_bytes: &[u8]) -> Result<(), String> {
    Err("update staging is Windows-only".into())
}
