use std::time::{SystemTime, UNIX_EPOCH};

/// Current epoch time in milliseconds.
pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// The interactive Windows account the agent runs as.
pub fn windows_user() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "unknown".to_string())
}

/// The machine name.
pub fn hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}

/// Coarse platform string (no content), e.g. "windows".
pub fn platform() -> String {
    std::env::consts::OS.to_string()
}

/// Minutes that, added to local time, give UTC — i.e. the same convention as
/// JavaScript's `Date.getTimezoneOffset()`. The server uses this to bucket
/// samples into the device's local calendar day.
#[cfg(windows)]
pub fn tz_offset_minutes() -> i32 {
    use windows::Win32::System::Time::{
        GetTimeZoneInformation, TIME_ZONE_INFORMATION,
    };
    const TIME_ZONE_ID_DAYLIGHT: u32 = 2;
    unsafe {
        let mut tzi = TIME_ZONE_INFORMATION::default();
        let result = GetTimeZoneInformation(&mut tzi);
        let extra = if result == TIME_ZONE_ID_DAYLIGHT {
            tzi.DaylightBias
        } else {
            tzi.StandardBias
        };
        tzi.Bias + extra
    }
}

#[cfg(not(windows))]
pub fn tz_offset_minutes() -> i32 {
    0
}
