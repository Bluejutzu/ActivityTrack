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

        // Capture one sample immediately so a freshly-started agent shows up.
        record(&state, &queue);

        loop {
            thread::sleep(poll);
            record(&state, &queue);

            if last_flush.elapsed() >= flush_every {
                flush(&state, &queue);
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
    queue.enqueue(&sample);

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

fn flush(state: &AppState, queue: &SampleQueue) {
    let pending = queue.read_all();
    if pending.is_empty() {
        return;
    }
    match send_batch(&state.config, &pending) {
        Ok(()) => {
            queue.remove_first(pending.len());
            let mut s = state.status.lock().expect("status mutex poisoned");
            s.online = true;
            s.last_error = None;
            s.last_sent_at = Some(host::now_ms());
            s.queue_length = queue.len();
        }
        Err(err) => {
            let mut s = state.status.lock().expect("status mutex poisoned");
            s.online = false;
            s.last_error = Some(err);
            s.queue_length = queue.len();
        }
    }
}
