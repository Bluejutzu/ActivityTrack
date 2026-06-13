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

The tracker reads from `%ProgramData%\ActivityTrack\config.json`:

```json
{
  "convexUrl": "https://<deployment>.convex.site",
  "ingestKey": "<shared ingest secret>"
}
```

Optional timing overrides: `pollIntervalMs` (15000), `idleThresholdMs` (60000),
`flushIntervalMs` (30000), `maxQueueSize` (5000).

### Installation & secrets

**Released installer** (Windows users):
- The `.exe` is pre-configured with `convexUrl` + `ingestKey` baked in
- The installer copies `config.json` to `%ProgramData%\ActivityTrack` during setup
- No manual config needed; just run the installer and it works

**Local development** (build from source):
1. Set env vars: `ACTIVITYTRACK_CONVEX_URL` and `ACTIVITYTRACK_INGEST_KEY` (or
   create `config.json` manually in `%ProgramData%\ActivityTrack`)
2. Run `pnpm --filter @activitytrack/desktop tauri:dev`

**Release workflow** (CI/CD):
- Set GitHub repo secrets: `ACTIVITYTRACK_CONVEX_URL` and `ACTIVITYTRACK_INGEST_KEY`
  (via `gh secret set` or repo settings)
- Push a tag `v*` → the workflow builds a pre-configured installer and uploads it
  to the Release

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
