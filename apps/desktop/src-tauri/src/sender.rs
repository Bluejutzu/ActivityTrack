use std::time::Duration;

use serde_json::json;

use crate::model::{ActivitySample, ClaimOutcome, Outcome};

/// POST a batch of samples to Convex /ingest using the per-device token.
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

/// Report a local operational event to Convex /agent/event using the device
/// token, so the dashboard's System Health page can show it centrally.
/// Best-effort: the caller ignores the result.
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

/// Announce this device to the dashboard (POST {api_url}/agent/register).
/// Unauthenticated — the agent presents only its deviceId and a one-time pairing
/// nonce, landing in the pending queue. Idempotent; returns the server-reported
/// status string (e.g. "pending" / "active" / "disabled").
pub fn register(
    api_url: &str,
    device_id: &str,
    hostname: &str,
    windows_user: &str,
    agent_version: &str,
    claim_nonce: &str,
) -> Result<String, String> {
    if api_url.is_empty() {
        return Err("api url not configured".into());
    }
    let url = format!("{}/agent/register", api_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(20))
        .build();

    let resp = agent
        .post(&url)
        .set("content-type", "application/json")
        .send_json(json!({
            "deviceId": device_id,
            "hostname": hostname,
            "windowsUser": windows_user,
            "agentVersion": agent_version,
            "claimNonce": claim_nonce,
        }));

    match resp {
        Ok(r) => {
            let body: serde_json::Value = r.into_json().map_err(|e| e.to_string())?;
            Ok(body["status"].as_str().unwrap_or("pending").to_string())
        }
        Err(ureq::Error::Status(code, r)) => {
            let msg = r.into_string().unwrap_or_default();
            Err(format!("HTTP {code}: {msg}"))
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Poll for approval (POST {api_url}/agent/poll). On the first poll after an
/// admin approves, the response carries the freshly minted device token — the
/// agent's only chance to capture it. See `ClaimOutcome`.
pub fn claim(api_url: &str, device_id: &str, claim_nonce: &str) -> Result<ClaimOutcome, String> {
    if api_url.is_empty() {
        return Err("api url not configured".into());
    }
    let url = format!("{}/agent/poll", api_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(20))
        .build();

    let resp = agent
        .post(&url)
        .set("content-type", "application/json")
        .send_json(json!({ "deviceId": device_id, "claimNonce": claim_nonce }));

    match resp {
        Ok(r) => {
            let body: serde_json::Value = r.into_json().map_err(|e| e.to_string())?;
            match body["status"].as_str().unwrap_or("") {
                "active" => match body["token"].as_str() {
                    Some(token) if !token.is_empty() => Ok(ClaimOutcome::Active(token.to_string())),
                    _ => Ok(ClaimOutcome::AlreadyClaimed),
                },
                "pending" => Ok(ClaimOutcome::Pending),
                "disabled" => Ok(ClaimOutcome::Disabled),
                "denied" => Ok(ClaimOutcome::Denied),
                "unknown" => Ok(ClaimOutcome::Unknown),
                other => Err(format!("unexpected poll status: {other}")),
            }
        }
        Err(ureq::Error::Status(code, r)) => {
            let msg = r.into_string().unwrap_or_default();
            Err(format!("HTTP {code}: {msg}"))
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Verify the debug-login password via the device-token-authenticated
/// /agent/verify-password endpoint (the device must already be paired).
///
/// Returns a structured `Outcome` so each distinct failure stays debuggable:
/// - `ok`              — password correct
/// - `wrong`          — 401, wrong password
/// - `unset`          — 503, no password set in the dashboard yet
/// - `not_configured` — missing Convex URL or no device token (never attempts
///                       the request)
/// - `server`         — reached the server but it returned an unexpected status
/// - `network`        — transport failure (DNS, refused, TLS, timeout)
pub fn verify_password(convex_url: &str, device_key: Option<&str>, password: &str) -> Outcome {
    if convex_url.is_empty() {
        return Outcome::with(
            "not_configured",
            "Convex URL is not set (config.json \"convexUrl\" or the \
             ACTIVITYTRACK_CONVEX_URL environment variable).",
        );
    }
    let Some(device_key) = device_key.filter(|k| !k.is_empty()) else {
        return Outcome::with(
            "not_configured",
            "This device is not paired yet — no device token to authenticate \
             the password check.",
        );
    };

    let url = format!("{}/agent/verify-password", convex_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(15))
        .build();

    let response = agent
        .post(&url)
        .set("authorization", &format!("Bearer {}", device_key))
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
