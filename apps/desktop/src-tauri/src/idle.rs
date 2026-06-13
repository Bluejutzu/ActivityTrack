//! Idle detection via the Win32 API — NOT a keylogger.
//!
//! We call `GetLastInputInfo`, which returns the tick count of the most recent
//! keyboard/mouse input system-wide. We never capture WHICH keys were pressed
//! or where the mouse went — only "how long since the last input". That is the
//! whole privacy story: activity, not content.
//!
//! `GetLastInputInfo` only reports input for the calling session, so the agent
//! must run in the interactive user session (launched at logon), not as a
//! session-0 service.

/// Milliseconds since the last keyboard or mouse input in this session.
#[cfg(windows)]
pub fn get_idle_ms() -> u64 {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut info).as_bool() {
            // Handle the 32-bit tick wraparound (~49.7 days uptime).
            let tick = GetTickCount();
            tick.wrapping_sub(info.dwTime) as u64
        } else {
            0
        }
    }
}

/// Dev/non-Windows stub: always reports "just active" so the loop can be
/// exercised off-Windows. Real idle detection is Windows-only by design.
#[cfg(not(windows))]
pub fn get_idle_ms() -> u64 {
    0
}
