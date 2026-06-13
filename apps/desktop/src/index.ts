import os from "node:os";
import { getOrCreateDeviceId } from "./device.js";
import { getIdleMs } from "./idle.js";
import { loadConfig } from "./config.js";
import { SampleQueue } from "./queue.js";
import { sendBatch } from "./sender.js";
import { AGENT_VERSION, type ActivitySample } from "@activitytrack/shared";

/**
 * ActivityTrack agent main loop.
 *
 * Design goals: tiny footprint, no UI, no unbounded memory. We poll idle time
 * on an interval, build a small immutable sample, push it onto a bounded
 * on-disk queue, and periodically flush the queue to Convex. Everything the
 * dashboard needs (active/idle, who, which machine, when) is derived from these
 * samples server-side.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const deviceId = getOrCreateDeviceId();
  const queue = new SampleQueue(config.maxQueueSize);

  const sample = (): ActivitySample => {
    const idleMs = getIdleMs();
    return {
      deviceId,
      // os.userInfo() is the user the agent runs as = the logged-in Windows user.
      windowsUser: safeUser(),
      hostname: os.hostname(),
      idleMs,
      active: idleMs < config.idleThresholdMs,
      capturedAt: Date.now(),
      tzOffsetMinutes: new Date().getTimezoneOffset(),
      agentVersion: AGENT_VERSION,
      platform: `${os.platform()} ${os.release()}`,
    };
  };

  // Poll: cheap, synchronous, allocates one small object per tick.
  setInterval(() => queue.enqueue(sample()), config.pollIntervalMs);

  // Flush: drain the queue, keep whatever didn't send.
  setInterval(async () => {
    const pending = queue.readAll();
    if (pending.length === 0) return;
    const ok = await sendBatch(config, pending);
    if (ok) queue.replace([]);
  }, config.flushIntervalMs);

  // Capture one sample immediately so a freshly-started agent shows up.
  queue.enqueue(sample());
}

function safeUser(): string {
  try {
    return os.userInfo().username;
  } catch {
    return process.env.USERNAME ?? "unknown";
  }
}

main().catch((err) => {
  // Last-resort guard; the scheduled task / watchdog will restart us.
  console.error("[activitytrack] fatal", err);
  process.exit(1);
});
