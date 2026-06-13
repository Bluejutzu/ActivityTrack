use std::time::Duration;

use serde_json::json;

use crate::config::Config;
use crate::model::ActivitySample;

/// POST a batch of samples to /ingest using the device-specific key.
pub fn send_batch(config: &Config, batch: &[ActivitySample]) -> Result<(), String> {
    if batch.is_empty() {
        return Ok(());
    }
    let device_key = config
        .device_key
        .as_deref()
        .ok_or_else(|| "not enrolled".to_string())?;
    if config.convex_url.is_empty() {
        return Err("not configured".into());
    }

    let url = format!("{}/ingest", config.convex_url.trim_end_matches('/'));
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
/// Returns one of: "ok", "wrong", "unset", "network".
pub fn verify_password(config: &Config, password: &str) -> String {
    let auth_key = config
        .device_key
        .as_deref()
        .unwrap_or(&config.bootstrap_key);
    if auth_key.is_empty() || config.convex_url.is_empty() {
        return "network".into();
    }

    let url = format!(
        "{}/agent/verify-password",
        config.convex_url.trim_end_matches('/')
    );
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(15))
        .build();

    let response = agent
        .post(&url)
        .set("authorization", &format!("Bearer {}", auth_key))
        .set("content-type", "application/json")
        .send_json(json!({ "password": password }));

    match response {
        Ok(_) => "ok".into(),
        Err(ureq::Error::Status(401, _)) => "wrong".into(),
        Err(ureq::Error::Status(503, _)) => "unset".into(),
        Err(_) => "network".into(),
    }
}
