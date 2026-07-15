use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::Mutex;

use crate::model::ActivitySample;
use crate::paths::{app_dir, queue_file};

/// Bounded, crash-safe offline queue backed by a JSONL file. If the network or
/// Convex is down, samples accumulate here and are flushed later. The cap
/// (`max_size`) guarantees the file can't grow without bound — oldest samples
/// are dropped first. An in-memory mirror avoids re-reading and re-parsing the
/// whole file on every tick; a sample is only enqueued on an active/idle
/// transition or a meaningful idle-duration jump (see `tracker::ChangeState`),
/// not on every poll, so writes here are the exception rather than the rule.
/// The file is only read once, at construction, to hydrate from a prior run.
pub struct SampleQueue {
    max_size: usize,
    samples: Mutex<Vec<ActivitySample>>,
}

impl SampleQueue {
    pub fn new(max_size: usize) -> Self {
        let _ = fs::create_dir_all(app_dir());
        let samples = Self::read_from_disk();
        SampleQueue {
            max_size,
            samples: Mutex::new(samples),
        }
    }

    fn read_from_disk() -> Vec<ActivitySample> {
        let Ok(text) = fs::read_to_string(queue_file()) else {
            return Vec::new();
        };
        text.lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str::<ActivitySample>(l).ok())
            .collect()
    }

    /// Append a sample to the in-memory queue and the on-disk file. Returns an
    /// error string if the sample couldn't be persisted (e.g. %ProgramData%
    /// locked down) or the cap couldn't be enforced, so the caller can surface
    /// it instead of silently losing data.
    pub fn enqueue(&self, sample: &ActivitySample) -> Result<(), String> {
        let line = serde_json::to_string(sample).map_err(|e| e.to_string())?;
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(queue_file())
            .map_err(|e| format!("cannot open queue file: {e}"))?;
        writeln!(f, "{line}").map_err(|e| format!("cannot write to queue: {e}"))?;

        let mut guard = self.samples.lock().unwrap_or_else(|e| e.into_inner());
        guard.push(sample.clone());
        if guard.len() > self.max_size {
            let start = guard.len() - self.max_size;
            guard.drain(0..start);
            let snapshot = guard.clone();
            drop(guard);
            return self.replace(&snapshot);
        }
        Ok(())
    }

    pub fn read_all(&self) -> Vec<ActivitySample> {
        self.samples
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    pub fn len(&self) -> usize {
        self.samples.lock().unwrap_or_else(|e| e.into_inner()).len()
    }

    /// Persist the given samples as the full queue contents, replacing both
    /// the in-memory mirror (already updated by the caller) and the on-disk
    /// file. Returns Err on an IO failure so the caller can surface it — a
    /// silent failure here would leave already-sent samples on disk to be
    /// re-sent (and double-counted).
    fn replace(&self, samples: &[ActivitySample]) -> Result<(), String> {
        let mut buf = String::new();
        for s in samples {
            if let Ok(line) = serde_json::to_string(s) {
                buf.push_str(&line);
                buf.push('\n');
            }
        }
        // Write to a sibling temp file, then atomically rename it over the live
        // queue. A crash or full disk mid-write can therefore only corrupt the
        // throwaway temp file — never truncate the queue and lose pending samples
        // (the failure mode of an in-place `fs::write`). On Windows, Rust's
        // `fs::rename` uses MOVEFILE_REPLACE_EXISTING, so this replaces atomically.
        let target = queue_file();
        let tmp = target.with_extension("jsonl.tmp");
        fs::write(&tmp, buf).map_err(|e| format!("cannot stage queue rewrite: {e}"))?;
        fs::rename(&tmp, &target).map_err(|e| format!("cannot replace queue: {e}"))
    }

    /// Drop the first `n` samples (the ones we just flushed), keeping any that
    /// were enqueued during the flush.
    pub fn remove_first(&self, n: usize) -> Result<(), String> {
        if n == 0 {
            return Ok(());
        }
        let snapshot = {
            let mut guard = self.samples.lock().unwrap_or_else(|e| e.into_inner());
            if n >= guard.len() {
                guard.clear();
            } else {
                guard.drain(0..n);
            }
            guard.clone()
        };
        self.replace(&snapshot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as StdMutex;

    // `paths::app_dir()` is process-wide (%ProgramData% / OS data dir), so tests
    // that touch the real queue file must not run concurrently with each other.
    static TEST_LOCK: StdMutex<()> = StdMutex::new(());

    fn sample(idle_ms: u64) -> ActivitySample {
        ActivitySample {
            device_id: "test-device".into(),
            windows_user: "tester".into(),
            hostname: "test-host".into(),
            idle_ms,
            active: idle_ms == 0,
            captured_at: idle_ms,
            tz_offset_minutes: 0,
            agent_version: "0.0.0-test".into(),
            platform: "test".into(),
            kind: None,
        }
    }

    fn reset_queue_file() {
        let _ = fs::remove_file(queue_file());
        let _ = fs::remove_file(queue_file().with_extension("jsonl.tmp"));
    }

    #[test]
    fn enqueue_then_read_all_round_trips() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_queue_file();

        let q = SampleQueue::new(100);
        q.enqueue(&sample(0)).unwrap();
        q.enqueue(&sample(1_000)).unwrap();

        let all = q.read_all();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].idle_ms, 0);
        assert_eq!(all[1].idle_ms, 1_000);
        assert_eq!(q.len(), 2);

        // A fresh queue hydrates from the same on-disk file.
        let q2 = SampleQueue::new(100);
        assert_eq!(q2.len(), 2);

        reset_queue_file();
    }

    #[test]
    fn enqueue_trims_to_max_size() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_queue_file();

        let q = SampleQueue::new(3);
        for i in 0..5 {
            q.enqueue(&sample(i)).unwrap();
        }

        let all = q.read_all();
        assert_eq!(all.len(), 3);
        // Oldest samples (idle_ms 0, 1) were dropped; 2, 3, 4 remain.
        assert_eq!(
            all.iter().map(|s| s.idle_ms).collect::<Vec<_>>(),
            vec![2, 3, 4]
        );

        // The on-disk file must agree with the in-memory mirror after a trim.
        let q2 = SampleQueue::new(3);
        assert_eq!(q2.len(), 3);

        reset_queue_file();
    }

    #[test]
    fn remove_first_keeps_the_tail() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_queue_file();

        let q = SampleQueue::new(100);
        for i in 0..5 {
            q.enqueue(&sample(i)).unwrap();
        }

        q.remove_first(2).unwrap();
        let all = q.read_all();
        assert_eq!(
            all.iter().map(|s| s.idle_ms).collect::<Vec<_>>(),
            vec![2, 3, 4]
        );

        // Removing more than the length empties the queue.
        q.remove_first(100).unwrap();
        assert_eq!(q.len(), 0);

        reset_queue_file();
    }

    #[test]
    fn read_from_disk_tolerates_torn_lines() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_queue_file();

        fs::create_dir_all(app_dir()).unwrap();
        let good = sample(42);
        let good_line = serde_json::to_string(&good).unwrap();
        let content = format!("{good_line}\n{{not json\n\n{good_line}\n");
        fs::write(queue_file(), content).unwrap();

        let q = SampleQueue::new(100);
        let all = q.read_all();
        assert_eq!(all.len(), 2);
        assert_eq!(
            all.iter().map(|s| s.idle_ms).collect::<Vec<_>>(),
            vec![42, 42]
        );

        reset_queue_file();
    }
}
