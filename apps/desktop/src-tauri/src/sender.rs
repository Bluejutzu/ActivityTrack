use std::time::Duration;

use serde_json::json;

use crate::model::{ActivitySample, Outcome};

/// POST a batch of samples to /ingest using the device-specific key.
pub fn send_batch(
    convex_url: &str,
    device_key: &str,
    batch: &[ActivitySample],
) -> Result<(), String> {
    if batch.is_empty() {
        return Ok(());
    }
    if convex_url.is_empty() {
        return Err("not configured".into());
    }

    let url = format!("{}/ingest", convex_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(15))
        .build();

    let response = agent
        .post(&url)
        .set("authorization", &format!("Bearer {}", device_key))
        .set("content-type", "application/json")
        .send_json(json!({ "samples": batch }));

    match response {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(code, _)) => Err(format!("HTTP {code}")),
        Err(e) => Err(e.to_string()),
    }
}

/// Report a local operational event to /agent/event using the device key, so
/// the dashboard's System Health page can show it centrally. Best-effort: the
/// caller ignores the result.
pub fn report_event(
    convex_url: &str,
    device_key: &str,
    severity: &str,
    code: &str,
    message: &str,
    hostname: &str,
) -> Result<(), String> {
    if convex_url.is_empty() {
        return Err("not configured".into());
    }

    let url = format!("{}/agent/event", convex_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(10))
        .build();

    let response = agent
        .post(&url)
        .set("authorization", &format!("Bearer {}", device_key))
        .set("content-type", "application/json")
        .send_json(json!({
            "severity": severity,
            "code": code,
            "message": message,
            "hostname": hostname,
        }));

    match response {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(c, _)) => Err(format!("HTTP {c}")),
        Err(e) => Err(e.to_string()),
    }
}

/// Register this device using a one-time enrollment code. Returns the
/// device-specific key to store and use for future /ingest calls.
pub fn register_device(
    convex_url: &str,
    bootstrap_key: &str,
    enrollment_code: &str,
    device_id: &str,
    hostname: &str,
    windows_user: &str,
    agent_version: &str,
) -> Result<String, String> {
    let url = format!("{}/agent/register", convex_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(20))
        .build();

    let resp = agent
        .post(&url)
        .set("authorization", &format!("Bearer {}", bootstrap_key))
        .set("content-type", "application/json")
        .send_json(json!({
            "enrollmentCode": enrollment_code,
            "deviceId": device_id,
            "hostname": hostname,
            "windowsUser": windows_user,
            "agentVersion": agent_version,
        }));

    match resp {
        Ok(r) => {
            let body: serde_json::Value = r.into_json().map_err(|e| e.to_string())?;
            body["deviceKey"]
                .as_str()
                .map(|k| k.to_string())
                .ok_or_else(|| "No deviceKey in response".into())
        }
        Err(ureq::Error::Status(code, r)) => {
            let msg = r.into_string().unwrap_or_default();
            Err(format!("HTTP {code}: {msg}"))
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Verify the debug-login password via the keyed /agent/verify-password
/// endpoint. Uses device key if enrolled, falls back to bootstrap key for dev.
///
/// Returns a structured `Outcome` instead of a flat string so each distinct
/// failure stays distinct (and debuggable):
/// - `ok`              — password correct
/// - `wrong`          — 401, wrong password
/// - `unset`          — 503, no password set in the dashboard yet
/// - `not_configured` — missing Convex URL or missing credentials (never even
///                       attempts the request; the old code reported these as
///                       "network", which is what made this undebuggable)
/// - `server`         — reached the server but it returned an unexpected status
/// - `network`        — transport failure (DNS, refused, TLS, timeout)
pub fn verify_password(
    convex_url: &str,
    device_key: Option<&str>,
    bootstrap_key: &str,
    password: &str,
) -> Outcome {
    if convex_url.is_empty() {
        return Outcome::with(
            "not_configured",
            "Convex URL is not set (config.json \"convexUrl\" or the \
             ACTIVITYTRACK_CONVEX_URL environment variable).",
        );
    }
    let auth_key = device_key.unwrap_or(bootstrap_key);
    if auth_key.is_empty() {
        return Outcome::with(
            "not_configured",
            "No credentials available: this device is not enrolled and no \
             bootstrap key is set (config.json \"ingestKey\" or the \
             ACTIVITYTRACK_INGEST_KEY environment variable).",
        );
    }

    let url = format!("{}/agent/verify-password", convex_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(15))
        .build();

    let response = agent
        .post(&url)
        .set("authorization", &format!("Bearer {}", auth_key))
        .set("content-type", "application/json")
        .send_json(json!({ "password": password }));

    match response {
        Ok(_) => Outcome::of("ok"),
        Err(ureq::Error::Status(401, _)) => Outcome::of("wrong"),
        Err(ureq::Error::Status(503, _)) => Outcome::of("unset"),
        Err(ureq::Error::Status(code, r)) => {
            let body: String = r.into_string().unwrap_or_default();
            let body = body.trim().chars().take(200).collect::<String>();
            let detail = if body.is_empty() {
                format!("HTTP {code} from {url}")
            } else {
                format!("HTTP {code} from {url}: {body}")
            };
            Outcome::with("server", detail)
        }
        Err(e) => Outcome::with("network", format!("{url}: {e}")),
    }
}
