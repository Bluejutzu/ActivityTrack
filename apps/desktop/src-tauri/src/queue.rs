use std::fs::{self, OpenOptions};
use std::io::Write;

use crate::model::ActivitySample;
use crate::paths::{app_dir, queue_file};

/// Bounded, crash-safe offline queue backed by a JSONL file. If the network or
/// Convex is down, samples accumulate here and are flushed later. The cap
/// (`max_size`) guarantees the file can't grow without bound — oldest samples
/// are dropped first. Nothing is ever held unboundedly in memory.
pub struct SampleQueue {
    max_size: usize,
}

impl SampleQueue {
    pub fn new(max_size: usize) -> Self {
        let _ = fs::create_dir_all(app_dir());
        SampleQueue { max_size }
    }

    /// Append a sample to the on-disk queue. Returns an error string if the
    /// sample couldn't be persisted (e.g. %ProgramData% locked down) so the
    /// caller can surface it instead of silently losing data. `trim` is
    /// best-effort recovery and does not fail the enqueue.
    pub fn enqueue(&self, sample: &ActivitySample) -> Result<(), String> {
        let line = serde_json::to_string(sample).map_err(|e| e.to_string())?;
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(queue_file())
            .map_err(|e| format!("cannot open queue file: {e}"))?;
        writeln!(f, "{line}").map_err(|e| format!("cannot write to queue: {e}"))?;
        self.trim();
        Ok(())
    }

    pub fn read_all(&self) -> Vec<ActivitySample> {
        let Ok(text) = fs::read_to_string(queue_file()) else {
            return Vec::new();
        };
        text.lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str::<ActivitySample>(l).ok())
            .collect()
    }

    pub fn len(&self) -> usize {
        self.read_all().len()
    }

    /// Persist the remaining (un-sent) samples after a flush.
    fn replace(&self, samples: &[ActivitySample]) {
        let mut buf = String::new();
        for s in samples {
            if let Ok(line) = serde_json::to_string(s) {
                buf.push_str(&line);
                buf.push('\n');
            }
        }
        let _ = fs::write(queue_file(), buf);
    }

    /// Drop the first `n` samples (the ones we just flushed), keeping any that
    /// were enqueued during the flush.
    pub fn remove_first(&self, n: usize) {
        if n == 0 {
            return;
        }
        let all = self.read_all();
        let keep = if n >= all.len() { &[][..] } else { &all[n..] };
        self.replace(keep);
    }

    fn trim(&self) {
        let all = self.read_all();
        if all.len() > self.max_size {
            let start = all.len() - self.max_size;
            self.replace(&all[start..]);
        }
    }
}
