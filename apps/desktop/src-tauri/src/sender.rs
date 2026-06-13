use std::time::Duration;

use serde_json::json;

use crate::config::Config;
use crate::model::ActivitySample;

/// POST a batch of samples to the Convex `/ingest` endpoint with the bearer key
/// and a hard request timeout. The agent does NO validation of its own beyond
/// shaping the payload — all trust/schema checks happen server-side. Returns
/// Ok(()) on a 2xx, Err(message) otherwise so the caller keeps the batch.
pub fn send_batch(config: &Config, batch: &[ActivitySample]) -> Result<(), String> {
    if batch.is_empty() {
        return Ok(());
    }
    if !config.is_configured() {
        return Err("not configured".into());
    }

    let url = format!("{}/ingest", config.convex_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(15))
        .build();

    let response = agent
        .post(&url)
        .set("authorization", &format!("Bearer {}", config.ingest_key))
        .set("content-type", "application/json")
        .send_json(json!({ "samples": batch }));

    match response {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(code, _)) => Err(format!("HTTP {code}")),
        Err(e) => Err(e.to_string()),
    }
}

/// Verify a candidate debug-login password against the hash IT set in the
/// dashboard, via the keyed `/agent/verify-password` endpoint. The hash never
/// leaves the server. Returns one of: "ok", "wrong", "unset", "network".
pub fn verify_password(config: &Config, password: &str) -> String {
    if !config.is_configured() {
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
        .set("authorization", &format!("Bearer {}", config.ingest_key))
        .set("content-type", "application/json")
        .send_json(json!({ "password": password }));

    match response {
        Ok(_) => "ok".into(),
        Err(ureq::Error::Status(401, _)) => "wrong".into(),
        Err(ureq::Error::Status(503, _)) => "unset".into(),
        Err(_) => "network".into(),
    }
}
