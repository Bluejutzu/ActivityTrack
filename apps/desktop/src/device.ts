import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { APP_DIR, DEVICE_ID_FILE } from "./paths.js";

/**
 * Returns a stable per-DEVICE identifier, generating + persisting one on first
 * run. Stored in %ProgramData% so it is the same regardless of which Windows
 * user is logged in. This id is the primary key the backend uses to identify a
 * physical machine.
 */
export function getOrCreateDeviceId(): string {
  mkdirSync(APP_DIR, { recursive: true });
  if (existsSync(DEVICE_ID_FILE)) {
    const existing = readFileSync(DEVICE_ID_FILE, "utf8").trim();
    if (existing) return existing;
  }
  const id = randomUUID();
  // Write atomically-ish; the installer should also lock this dir down to admins.
  writeFileSync(DEVICE_ID_FILE, id, { encoding: "utf8", flag: "w" });
  return id;
}
