use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use serde_json::json;

use crate::model::{ActivitySample, ClaimOutcome, Outcome};

/// Largest number of samples sent in a single `/ingest` POST. Bounds the
/// request body if a long outage lets the queue build up to `max_queue_size`
/// (default 5,000) before the connection recovers.
const SEND_CHUNK_SIZE: usize = 500;

/// Pause between chunks of the same flush. Must be slightly above
/// `MIN_INGEST_INTERVAL_MS` in convex/ingest.ts (3s) so a backlog spanning
/// several chunks doesn't self-throttle its own second-and-later chunks —
/// see the note on `SendOutcome` below.
const CHUNK_PACING: Duration = Duration::from_millis(3_200);

/// One shared `ureq::Agent` for all outbound calls, instead of building a new
/// one (and its connection pool) per request — the periodic flush/pair loop
/// otherwise pays a fresh TLS handshake on every tick. Per-call timeouts are
/// still applied per-request (see call sites) to keep each endpoint's original
/// budget.
static AGENT: OnceLock<ureq::Agent> = OnceLock::new();

fn agent() -> &'static ureq::Agent {
    AGENT.get_or_init(|| ureq::AgentBuilder::new().build())
}

/// Outcome of `send_batch`: `sent` counts samples confirmed persisted
/// server-side (in whole chunks) before `error` (if any) stopped the run.
///
/// A partial send can still happen if a chunk fails mid-flush (network drop,
/// server error). `CHUNK_PACING` between chunks keeps a multi-chunk backlog
/// from self-throttling on the server's per-device rate limit (see
/// `MIN_INGEST_INTERVAL_MS` in convex/ingest.ts). The caller must still drop
/// whatever chunks did succeed instead of re-sending them every tick forever.
pub struct SendOutcome {
    pub sent: usize,
    pub error: Option<String>,
    /// Seconds the server asked us to wait before retrying (from the `Retry-
    /// After` header on a non-2xx response), when present.
    pub retry_after_secs: Option<u64>,
}

/// POST a batch of samples to Convex /ingest using the per-device token.
/// Large batches are split into chunks so no single request body is
/// unbounded; a chunk failure stops sending further chunks, but chunks that
/// already succeeded are still reflected in `SendOutcome::sent` so the caller
/// can drop them from the local queue and make progress instead of retrying
/// the same throttled batch indefinitely.
pub fn send_batch(convex_url: &str, device_key: &str, batch: &[ActivitySample]) -> SendOutcome {
    if batch.is_empty() {
        return SendOutcome {
            sent: 0,
            error: None,
            retry_after_secs: None,
        };
    }
    if convex_url.is_empty() {
        return SendOutcome {
            sent: 0,
            error: Some("not configured".into()),
            retry_after_secs: None,
        };
    }

    let url = format!("{}/ingest", convex_url.trim_end_matches('/'));
    let mut sent = 0;

    let mut chunks = batch.chunks(SEND_CHUNK_SIZE).peekable();
    while let Some(chunk) = chunks.next() {
        let response = agent()
            .post(&url)
            .timeout(Duration::from_secs(15))
            .set("authorization", &format!("Bearer {}", device_key))
            .set("content-type", "application/json")
            .send_json(json!({ "samples": chunk }));

        match response {
            Ok(_) => {
                sent += chunk.len();
                // Space out chunks of the same flush so a multi-chunk backlog
                // doesn't immediately trip the server's per-device throttle
                // on its own follow-up chunk.
                if chunks.peek().is_some() {
                    thread::sleep(CHUNK_PACING);
                }
            }
            Err(ureq::Error::Status(code, resp)) => {
                let retry_after_secs = resp
                    .header("retry-after")
                    .and_then(|v| v.trim().parse::<u64>().ok());
                let body = resp
                    .into_string()
                    .unwrap_or_default()
                    .trim()
                    .chars()
                    .take(200)
                    .collect::<String>();
                let error = Some(if body.is_empty() {
                    format!("HTTP {code}")
                } else {
                    format!("HTTP {code}: {body}")
                });
                return SendOutcome {
                    sent,
                    error,
                    retry_after_secs,
                };
            }
            Err(e) => {
                return SendOutcome {
                    sent,
                    error: Some(e.to_string()),
                    retry_after_secs: None,
                };
            }
        }
    }
    SendOutcome {
        sent,
        error: None,
        retry_after_secs: None,
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

    let response = agent()
        .post(&url)
        .timeout(Duration::from_secs(10))
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

    let resp = agent()
        .post(&url)
        .timeout(Duration::from_secs(20))
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

    let resp = agent()
        .post(&url)
        .timeout(Duration::from_secs(20))
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
///   the request)
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

    let response = agent()
        .post(&url)
        .timeout(Duration::from_secs(15))
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
