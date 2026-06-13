import path from "node:path";

/**
 * All persistent state lives under %ProgramData%\ActivityTrack so it is shared
 * across every Windows user on the device and survives app updates.
 * The device identity in particular MUST live here (not per-user).
 */
const PROGRAM_DATA =
  process.env.PROGRAMDATA ?? "C:\\ProgramData";

export const APP_DIR = path.join(PROGRAM_DATA, "ActivityTrack");
export const DEVICE_ID_FILE = path.join(APP_DIR, "device-id");
export const CONFIG_FILE = path.join(APP_DIR, "config.json");
export const QUEUE_FILE = path.join(APP_DIR, "queue.jsonl");
export const LOG_FILE = path.join(APP_DIR, "agent.log");
