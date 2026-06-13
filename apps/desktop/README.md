# @activitytrack/desktop

The ActivityTrack **tracker** — a tray-resident Tauri (Rust) app for Windows.
It is the data source: it detects active/idle via Win32 input timing and POSTs
samples to Convex. It does **no** validation of its own (the backend does all
of it). No screenshots, no keystroke content — only "how long since the last
input".

## Behaviour

- **Headless-ish / tray-only.** Starts **hidden** on logon; lives in the system
  tray. Closing the window hides it back to the tray (quit via the tray menu).
- **Launch at logon, interactive session.** Autostart is enabled on first run
  (HKCU `Run`) so idle detection runs in the user's interactive session —
  `GetLastInputInfo` only sees input there, never in session 0.
- **Login-gated UI.** Opening the window shows a password prompt. The password
  is set by IT in the web dashboard; the tracker verifies a candidate against
  the stored hash via the keyed `/agent/verify-password` endpoint (the hash
  never leaves the server). Once unlocked it shows a read-only status + debug
  panel (active/idle, device id, queue length, last-sent samples, errors,
  config). German (default) and English.
- **Bounded everywhere.** The offline queue is a capped JSONL file in
  `%ProgramData%\ActivityTrack` (oldest dropped first); nothing grows unbounded.

## Configuration

Per-machine `%ProgramData%\ActivityTrack\config.json` (the installer writes it):

```json
{
  "convexUrl": "https://<deployment>.convex.site",
  "ingestKey": "<shared ingest secret>"
}
```

Optional timing overrides: `pollIntervalMs` (15000), `idleThresholdMs` (60000),
`flushIntervalMs` (30000), `maxQueueSize` (5000). For local dev the secrets can
come from `ACTIVITYTRACK_CONVEX_URL` / `ACTIVITYTRACK_INGEST_KEY` env vars.

## Develop / build

```bash
pnpm --filter @activitytrack/desktop dev          # frontend only (Vite)
pnpm --filter @activitytrack/desktop tauri:dev     # full app (needs Rust)
pnpm --filter @activitytrack/desktop tauri:build    # bundle the Windows installer
```

Building the Windows installer requires a Windows host (or the
`.github/workflows/release.yml` job, which runs on `windows-latest` for `v*`
tags). The app icons are generated from `app-icon.png` via `tauri icon` and
committed under `src-tauri/icons`.
