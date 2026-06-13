use std::fs;

use uuid::Uuid;

use crate::paths::{app_dir, device_id_file};

/// Returns a stable per-DEVICE id, generating + persisting one on first run.
/// Stored in %ProgramData% so it is the same regardless of which Windows user
/// is logged in. The installer pre-mints this file and locks it to admins; if
/// it already exists we simply reuse it.
pub fn get_or_create_device_id() -> String {
    let _ = fs::create_dir_all(app_dir());
    let path = device_id_file();

    if let Ok(existing) = fs::read_to_string(&path) {
        let trimmed = existing.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let id = Uuid::new_v4().to_string();
    // Best-effort write; if the dir is locked down and we can't write, we still
    // return a valid id for this session.
    let _ = fs::write(&path, &id);
    id
}
