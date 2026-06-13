use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use crate::host;
use crate::idle::get_idle_ms;
use crate::model::{ActivitySample, UiSample, AGENT_VERSION};
use crate::queue::SampleQueue;
use crate::sender::send_batch;
use crate::state::AppState;

// Keep only the most recent N samples in memory for the debug UI table.
const UI_SAMPLE_HISTORY: usize = 20;

/// Spawn the background tracking loop on its own OS thread. It polls idle time,
/// enqueues a sample, and periodically flushes the on-disk queue to Convex —
/// independent of whether the tray UI is open. Allocation-light and resilient:
/// a failed flush keeps the batch; nothing here can panic the UI thread.
pub fn start(state: Arc<AppState>) {
    thread::spawn(move || {
        let queue = SampleQueue::new(state.config.max_queue_size);
        let poll = Duration::from_millis(state.config.poll_interval_ms.max(1_000));
        let flush_every = Duration::from_millis(state.config.flush_interval_ms.max(1_000));
        let mut last_flush = Instant::now();
        // Consecutive flush failures; we only escalate to the backend once a
        // few in a row confirm it's not a momentary blip (laptop asleep, etc.).
        let mut fail_streak: u32 = 0;

        // Capture one sample immediately so a freshly-started agent shows up.
        record(&state, &queue);

        loop {
            thread::sleep(poll);
            record(&state, &queue);

            if last_flush.elapsed() >= flush_every {
                match flush(&state, &queue) {
                    Ok(_) => fail_streak = 0,
                    Err(err) => {
                        fail_streak += 1;
                        if fail_streak >= 3 {
                            // Throttled + best-effort inside report_event.
                            state.report_event("error", "tracker.send_failed", &err);
                        }
                    }
                }
                last_flush = Instant::now();
            }
        }
    });
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
    };
    (sample, active, idle_ms)
}

fn record(state: &AppState, queue: &SampleQueue) {
    let (sample, active, idle_ms) = build_sample(state);
    if let Err(err) = queue.enqueue(&sample) {
        // Local buffering failed — surface it and (throttled) tell the backend.
        state.push_error("tracker.queue_io", err.clone());
        state.report_event("error", "tracker.queue_io", &err);
    }

    let mut s = state.status.lock().expect("status mutex poisoned");
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
/// enrolled or empty), Err(msg) = a send was attempted and failed.
fn flush(state: &AppState, queue: &SampleQueue) -> Result<bool, String> {
    if !state.config.can_send() {
        return Ok(false);
    }
    let pending = queue.read_all();
    if pending.is_empty() {
        return Ok(false);
    }
    match send_batch(&state.config, &pending) {
        Ok(()) => {
            queue.remove_first(pending.len());
            let mut s = state.status.lock().expect("status mutex poisoned");
            s.online = true;
            s.last_error = None;
            s.last_sent_at = Some(host::now_ms());
            s.queue_length = queue.len();
            Ok(true)
        }
        Err(err) => {
            {
                let mut s = state.status.lock().expect("status mutex poisoned");
                s.online = false;
                s.queue_length = queue.len();
            }
            // Always surface locally (even the first failure); escalation to the
            // backend is gated by the caller's fail streak.
            state.push_error("tracker.send_failed", err.clone());
            Err(err)
        }
    }
}
