import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { QUEUE_FILE } from "./paths.js";
import type { ActivitySample } from "@activitytrack/shared";

/**
 * Bounded, crash-safe offline queue backed by a JSONL file. If the network or
 * Convex is down, samples accumulate here and are flushed later. The cap
 * (maxQueueSize) guarantees the file can't grow without bound — oldest samples
 * are dropped first. This is the main defense against the "memory/disk
 * overflow" concern: nothing is ever held unboundedly in memory.
 */
export class SampleQueue {
  constructor(private readonly maxSize: number) {}

  enqueue(sample: ActivitySample): void {
    appendFileSync(QUEUE_FILE, JSON.stringify(sample) + "\n", "utf8");
    this.trim();
  }

  /** Read all pending samples (caller flushes then calls clear/replace). */
  readAll(): ActivitySample[] {
    if (!existsSync(QUEUE_FILE)) return [];
    return readFileSync(QUEUE_FILE, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ActivitySample);
  }

  /** Persist the remaining (un-sent) samples after a partial flush. */
  replace(samples: ActivitySample[]): void {
    writeFileSync(
      QUEUE_FILE,
      samples.map((s) => JSON.stringify(s)).join("\n") + (samples.length ? "\n" : ""),
      "utf8",
    );
  }

  private trim(): void {
    const all = this.readAll();
    if (all.length > this.maxSize) {
      this.replace(all.slice(all.length - this.maxSize));
    }
  }
}
