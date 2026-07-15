use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use crate::host;
use crate::idle::get_idle_ms;
use crate::model::{ActivitySample, ClaimOutcome, SampleKind, UiSample, AGENT_VERSION};
use crate::queue::SampleQueue;
use crate::sender;
use crate::state::AppState;

// Keep only the most recent N samples in memory for the debug UI table.
const UI_SAMPLE_HISTORY: usize = 20;

// Cap on how long the pairing retry can back off to, so a long-denied/pending
// device still checks in at least this often once an admin does act.
const PAIR_BACKOFF_MAX_SECS: u64 = 300;

// Cap on how long the send/flush retry can back off to, mirroring
// PAIR_BACKOFF_MAX_SECS. Without a cap a persistently-throttled device would
// never come back to a normal cadence once an operator fixes the cause.
const SEND_BACKOFF_MAX_SECS: u64 = 300;

// Minimum idle-duration growth (while continuously idle, i.e. no active/idle
// flip) that still earns a fresh durable sample. Keeps a long idle stretch
// from being one opaque multi-hour gap in raw exports and the per-day
// timeline while staying far below the old constant 15s cadence.
const IDLE_RESAMPLE_MS: u64 = 5 * 60_000;

// How often to send a cheap keepalive ping while state hasn't changed enough
// to earn a durable sample. Two things depend on this staying comfortably
// under the server's MAX_ATTRIBUTION_MS (120s, convex/activity/ingest.ts):
// the offline threshold (offlineThresholdSeconds, default 120s) must never
// see a 2-minute-plus silent gap, and dailyStats attribution — which credits
// the gap between consecutive samples/keepalives, capped at 120s — must not
// get truncated across a long unchanged stretch.
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(60);

/// A failed flush, carrying the server's suggested wait (from `Retry-After`)
/// when it gave one, so the caller can back off instead of retrying on the
/// fixed flush cadence regardless of the failure reason.
struct FlushError {
    message: String,
    retry_after_secs: Option<u64>,
}

/// Spawn the background tracking loop on its own OS thread. It first enrolls (if
/// needed), then polls idle time, enqueues a sample, and periodically flushes
/// the on-disk queue to Convex — independent of whether the tray UI is open.
/// Doing enrollment here (rather than before the Tauri builder) means the tray
/// icon appears instantly even if the backend is slow or down. Allocation-light
/// and resilient: a failed flush keeps the batch; nothing here panics the UI.
pub fn start(state: Arc<AppState>) {
    thread::spawn(move || {
        // First-boot pairing, in the background. The flush guard below keeps us
        // from sending until a token is obtained; local recording starts anyway.
        // We keep retrying on the flush cadence until an admin approves us.
        try_pair(&state);

        let queue = SampleQueue::new(state.config.max_queue_size);
        let poll = Duration::from_millis(state.config.poll_interval_ms.max(1_000));
        let flush_every = Duration::from_millis(state.config.flush_interval_ms.max(1_000));
        let mut last_flush = Instant::now();
        // Consecutive flush failures; we only escalate to the backend once a
        // few in a row confirm it's not a momentary blip (laptop asleep, etc.).
        // Also drives send backoff below, so repeated failures (e.g. a
        // sustained 429) space attempts out instead of hammering every tick.
        let mut fail_streak: u32 = 0;
        let mut next_send_attempt = Instant::now();
        // Consecutive pairing attempts that didn't result in a token, so we can
        // back off exponentially (capped) instead of hammering /agent/register
        // and /agent/poll every flush tick while a device sits pending/denied.
        let mut pair_fail_streak: u32 = 0;
        let mut next_pair_attempt = Instant::now();

        // Run-length change detector: only a real active<->idle transition or
        // a meaningful idleMs jump earns a durable sample; everything in
        // between is covered by the cheap keepalive below.
        let mut changes = ChangeState::new();
        let mut last_keepalive = Instant::now();
        // Consecutive keepalive failures, mirroring `fail_streak` below —
        // escalated to the backend after a few in a row so a keepalive stuck
        // failing for minutes doesn't go unnoticed just because it's the
        // best-effort path (a single miss is not itself reported).
        let mut keepalive_fail_streak: u32 = 0;

        // Capture one sample immediately so a freshly-started agent shows up.
        record(
            &state,
            &queue,
            &mut changes,
            &mut last_keepalive,
            &mut keepalive_fail_streak,
        );

        loop {
            thread::sleep(poll);
            record(
                &state,
                &queue,
                &mut changes,
                &mut last_keepalive,
                &mut keepalive_fail_streak,
            );

            if last_flush.elapsed() >= flush_every {
                if state.can_send() {
                    if Instant::now() >= next_send_attempt {
                        match flush(&state, &queue) {
                            Ok(_) => {
                                fail_streak = 0;
                                next_send_attempt = Instant::now();
                            }
                            Err(err) => {
                                fail_streak += 1;
                                if fail_streak >= 3 {
                                    // Throttled + best-effort inside report_event.
                                    state.report_event(
                                        "error",
                                        "tracker.send_failed",
                                        &err.message,
                                    );
                                }
                                // Back off: honor the server's Retry-After when it
                                // gave one (e.g. a 429), otherwise fall back to the
                                // normal flush cadence, and grow it with repeated
                                // failures (capped) so a stuck device stops
                                // hammering an endpoint that keeps rejecting it.
                                let base = err
                                    .retry_after_secs
                                    .unwrap_or(flush_every.as_secs().max(1))
                                    .max(flush_every.as_secs().max(1));
                                let backoff_secs = base
                                    .saturating_mul(1u64 << fail_streak.min(4))
                                    .min(SEND_BACKOFF_MAX_SECS);
                                next_send_attempt =
                                    Instant::now() + Duration::from_secs(backoff_secs);
                            }
                        }
                    }
                } else if Instant::now() >= next_pair_attempt {
                    // Not paired yet (or just got revoked) — keep trying so the
                    // device comes online as soon as an admin approves it.
                    if try_pair(&state) {
                        pair_fail_streak = 0;
                    } else {
                        pair_fail_streak = pair_fail_streak.saturating_add(1);
                        let backoff_secs = flush_every
                            .as_secs()
                            .max(1)
                            .saturating_mul(1u64 << pair_fail_streak.min(4))
                            .min(PAIR_BACKOFF_MAX_SECS);
                        next_pair_attempt = Instant::now() + Duration::from_secs(backoff_secs);
                    }
                }
                last_flush = Instant::now();
            }
        }
    });
}

/// Drive the approve-to-pair flow: announce this device, then poll for approval.
/// Best-effort and idempotent — safe to call repeatedly while waiting for an
/// admin. Updates the pairing sub-state for the tray UI and, once approved,
/// stores the device token (which flips `can_send`). Returns whether the
/// device is paired after this attempt, so the caller can back off retries
/// while it keeps coming back false (pending/denied/error).
fn try_pair(state: &AppState) -> bool {
    if state.can_send() {
        return true;
    }
    if !state.config.can_pair() {
        state.set_pairing("unconfigured");
        return false;
    }
    let nonce = state.pairing_nonce();

    state.set_pairing("registering");
    if let Err(e) = sender::register(
        &state.config.api_url,
        &state.device_id,
        &state.hostname,
        &state.windows_user,
        AGENT_VERSION,
        &nonce,
    ) {
        state.set_pairing("error");
        state.push_error("tracker.pair_failed", e);
        return false;
    }

    match sender::claim(&state.config.api_url, &state.device_id, &nonce) {
        Ok(ClaimOutcome::Active(token)) => {
            state.set_device_key(token);
            state.clear_pairing_nonce();
            state.set_pairing("paired");
        }
        Ok(ClaimOutcome::Pending) => state.set_pairing("pending"),
        Ok(ClaimOutcome::Disabled) => state.set_pairing("disabled"),
        Ok(ClaimOutcome::AlreadyClaimed) => {
            // Approved, but the token was already issued and we don't hold it.
            // An admin must disable + re-approve to mint a fresh one.
            state.set_pairing("error");
            state.push_error(
                "tracker.pair_failed",
                "Device approved but its token was already claimed; ask an admin \
                 to disable and re-approve this device to re-pair."
                    .to_string(),
            );
        }
        Ok(ClaimOutcome::Denied) | Ok(ClaimOutcome::Unknown) => {
            // Our nonce no longer matches the server (another machine took this
            // deviceId, or the row was reset). Start fresh with a new nonce next
            // tick.
            state.clear_pairing_nonce();
            state.set_pairing("registering");
        }
        Err(e) => {
            state.set_pairing("error");
            state.push_error("tracker.pair_failed", e);
        }
    }
    state.can_send()
}

fn build_sample(state: &AppState) -> (ActivitySample, bool, u64) {
    let idle_ms = get_idle_ms();
    let active = idle_ms < state.config.idle_threshold_ms;
    let sample = ActivitySample {
        device_id: state.device_id.clone(),
        windows_user: state.windows_user.clone(),
        hostname: state.hostname.clone(),
        idle_ms,
        active,
        captured_at: host::now_ms(),
        tz_offset_minutes: host::tz_offset_minutes(),
        agent_version: AGENT_VERSION.to_string(),
        platform: host::platform(),
        kind: None,
    };
    (sample, active, idle_ms)
}

/// Tracks the (active, idleMs) of the last *durable* sample so `record` can
/// decide, run-length style, whether the current reading is worth persisting
/// or just a cheap keepalive.
struct ChangeState {
    last: Option<(bool, u64)>,
}

impl ChangeState {
    fn new() -> Self {
        ChangeState { last: None }
    }

    /// Whether `active`/`idle_ms` differs enough from the last durable sample
    /// to warrant a new one: any active<->idle flip, or — while continuously
    /// idle — idleMs growing by at least `IDLE_RESAMPLE_MS` since then. The
    /// very first reading always counts, so a freshly-started agent shows up
    /// immediately. Updates the tracked state whenever it returns true.
    fn changed(&mut self, active: bool, idle_ms: u64) -> bool {
        let changed = match self.last {
            None => true,
            Some((last_active, last_idle)) => {
                active != last_active
                    || (!active && idle_ms.saturating_sub(last_idle) >= IDLE_RESAMPLE_MS)
            }
        };
        if changed {
            self.last = Some((active, idle_ms));
        }
        changed
    }
}

/// Best-effort cheap ping so the server can still tell this device is online
/// and keep dailyStats attribution current while state is unchanged. Never
/// touches the durable queue — on failure the caller does not retry; the
/// next keepalive or the next real sample covers it.
fn send_keepalive(state: &AppState, device_key: &str, sample: &ActivitySample) -> Result<(), String> {
    let mut ping = sample.clone();
    ping.kind = Some(SampleKind::Keepalive);
    sender::send_keepalive(&state.config.convex_url, device_key, &ping)
}

fn record(
    state: &AppState,
    queue: &SampleQueue,
    changes: &mut ChangeState,
    last_keepalive: &mut Instant,
    keepalive_fail_streak: &mut u32,
) {
    let (sample, active, idle_ms) = build_sample(state);

    if changes.changed(active, idle_ms) {
        if let Err(err) = queue.enqueue(&sample) {
            // Local buffering failed — surface it and (throttled) tell the backend.
            state.push_error("tracker.queue_io", err.clone());
            state.report_event("error", "tracker.queue_io", &err);
        }
        // A durable sample already refreshes lastSeen server-side; no need
        // for an immediate follow-up keepalive.
        *last_keepalive = Instant::now();
    } else if last_keepalive.elapsed() >= KEEPALIVE_INTERVAL {
        if let Some(device_key) = state.device_key() {
            match send_keepalive(state, &device_key, &sample) {
                Ok(()) => {
                    *keepalive_fail_streak = 0;
                    let mut s = state.status.lock().unwrap_or_else(|e| e.into_inner());
                    s.online = true;
                    s.last_sent_at = Some(host::now_ms());
                }
                Err(err) => {
                    *keepalive_fail_streak = keepalive_fail_streak.saturating_add(1);
                    if *keepalive_fail_streak >= 3 {
                        state.report_event("error", "tracker.keepalive_failed", &err);
                    }
                }
            }
        }
        *last_keepalive = Instant::now();
    }

    let mut s = state.status.lock().unwrap_or_else(|e| e.into_inner());
    s.active = active;
    s.idle_ms = idle_ms;
    s.queue_length = queue.len();
    s.last_samples.push_front(UiSample {
        active,
        idle_ms,
        captured_at: sample.captured_at,
    });
    while s.last_samples.len() > UI_SAMPLE_HISTORY {
        s.last_samples.pop_back();
    }
}

/// Flush the queue. Ok(true) = sent a batch, Ok(false) = nothing to do (not
/// enrolled or empty), Err = a send was attempted and failed.
fn flush(state: &AppState, queue: &SampleQueue) -> Result<bool, FlushError> {
    if !state.can_send() {
        return Ok(false);
    }
    let pending = queue.read_all();
    if pending.is_empty() {
        return Ok(false);
    }
    let Some(device_key) = state.device_key() else {
        return Ok(false);
    };

    let outcome = sender::send_batch(&state.config.convex_url, &device_key, &pending);

    // Drop whatever chunks landed, even on a partial failure (e.g. a network
    // drop mid-flush) — otherwise the same already-sent prefix gets resent on
    // the next tick and the queue can't make progress.
    if outcome.sent > 0 {
        if let Err(err) = queue.remove_first(outcome.sent) {
            state.push_error("tracker.queue_io", err.clone());
            state.report_event("error", "tracker.queue_io", &err);
        }
    }

    match outcome.error {
        None => {
            let mut s = state.status.lock().unwrap_or_else(|e| e.into_inner());
            s.online = true;
            s.last_error = None;
            s.last_sent_at = Some(host::now_ms());
            s.queue_length = queue.len();
            Ok(true)
        }
        Some(err) => {
            {
                let mut s = state.status.lock().unwrap_or_else(|e| e.into_inner());
                // A chunk did land this tick even though a later one failed —
                // reflect that we did reach the server, and record it as the
                // last successful send instead of leaving it stuck at "never".
                if outcome.sent > 0 {
                    s.online = true;
                    s.last_sent_at = Some(host::now_ms());
                } else {
                    s.online = false;
                }
                s.queue_length = queue.len();
            }
            // A 401 means the token was revoked/disabled server-side: drop it so
            // the loop falls back into pairing (re-approval mints a fresh one).
            // Queued samples are kept and flushed once we're paired again.
            if err.contains("401") {
                state.clear_device_key();
                state.set_pairing("registering");
            }
            // Always surface locally (even the first failure); escalation to the
            // backend is gated by the caller's fail streak.
            state.push_error("tracker.send_failed", err.clone());
            Err(FlushError {
                message: err,
                retry_after_secs: outcome.retry_after_secs,
            })
        }
    }
}
