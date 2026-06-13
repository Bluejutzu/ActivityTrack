import { readFileSync, existsSync } from "node:fs";
import { CONFIG_FILE } from "./paths.js";

export interface AgentConfig {
  /** Convex HTTP Actions base URL, e.g. https://<deployment>.convex.site */
  convexUrl: string;
  /** Shared ingest secret the backend checks before accepting samples. */
  ingestKey: string;
  /** How often to sample input idle time. */
  pollIntervalMs: number;
  /** Idle threshold: above this many ms with no input => "inactive". */
  idleThresholdMs: number;
  /** How often to flush queued samples to Convex. */
  flushIntervalMs: number;
  /** Max samples kept in the offline queue before oldest are dropped. */
  maxQueueSize: number;
}

const DEFAULTS: AgentConfig = {
  convexUrl: process.env.ACTIVITYTRACK_CONVEX_URL ?? "",
  ingestKey: process.env.ACTIVITYTRACK_INGEST_KEY ?? "",
  pollIntervalMs: 15_000,
  idleThresholdMs: 60_000,
  flushIntervalMs: 30_000,
  maxQueueSize: 5_000,
};

/** Config precedence: file in %ProgramData% overrides env-derived defaults. */
export function loadConfig(): AgentConfig {
  if (!existsSync(CONFIG_FILE)) return DEFAULTS;
  try {
    const fromFile = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    return { ...DEFAULTS, ...fromFile };
  } catch {
    return DEFAULTS;
  }
}
