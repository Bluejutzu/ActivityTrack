# Releasing the desktop tracker

The Windows installer + auto-updater are built by `.github/workflows/release.yml`
on every `v*` tag. Use `pnpm bump-version <x.y.z>` to update all three version
files and create the tag in one step; CI then verifies they agree
(`scripts/check-version-sync.js`).

## Updater signing key — continuity (critical)

The updater verifies every downloaded build against the public key baked into
`apps/desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). The matching
**private** key lives only in the repo secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

**If this private key is ever lost, every already-installed agent permanently
stops auto-updating** — a new build signed with a different key fails signature
verification, and there is no way to push it through the updater. The only
recovery is to re-install all agents with a new installer carrying the new
pubkey.

Therefore:

1. **Back the key up now.** Store both the private key and its password in a
   password manager / secret vault that outlives any single person. Do not keep
   the only copy in GitHub secrets (which are write-only and can't be exported).
2. **Don't rotate casually.** Rotating the key orphans the installed fleet. If
   you must rotate: ship one build still signed with the *old* key whose
   `tauri.conf.json` already contains the *new* pubkey (so the fleet updates to a
   build that trusts the new key), and only then switch CI to sign with the new
   key. Otherwise plan a coordinated re-install.
3. CI fails fast (`Verify updater signing key is configured`) if the secret is
   absent, so a release can't silently ship unsigned.

## Bundled config / bootstrap key in the installer (trade-off)

The release workflow bakes `convexUrl` + `ingestKey` (and the public Clerk key)
into the installer's `config.json` (`bundle/nsis/installer.nsh`, regenerated from
GitHub secrets at build time). This gives a zero-touch install, at the cost of the
**bootstrap ingest key living inside the distributed `.exe`**.

This is an accepted trade-off for an internal, company-owned-device tool:

- The bootstrap key only authorizes device *enrollment*. Each enrolled device
  gets its own server-minted key; ingest and the password endpoint prefer that
  per-device key. Rotating the bootstrap key (Convex env + repo secret + new
  installer) invalidates only the enrollment path.
- The key is injected at build time from GitHub secrets — it is never in the
  source repo or the build logs.

**Alternative (no secret in the binary):** ship an installer with empty config
and have IT drop a `config.json` into `%ProgramData%\ActivityTrack\` before first
run. The NSIS hook only writes the file when it's missing, so a pre-placed config
is preserved. Choose this if distribution ever widens beyond trusted machines.

## Visibility (tray icon / auto-updates)

The agent runs with **no persistent UI by default** — no tray icon, and
auto-updates install in NSIS `quiet` mode (no installer window). This is
intentional for a background monitoring agent whose employees are informed of
its presence out-of-band; it avoids a constant visual reminder.

- To get the tray icon (Open/Quit menu) back on a specific machine for local
  debugging, set `"showTrayIcon": true` in that machine's
  `%ProgramData%\ActivityTrack\config.json` and restart the agent.
- With the tray icon off, the status/debug window is opened by relaunching
  `ActivityTrack.exe` — the single-instance guard forwards that into showing
  (recreating, if it was closed) the window instead of starting a second
  tracker.
- Windows may still show a UAC elevation prompt during an auto-update
  regardless of `installMode`, since this is a per-machine install — that part
  depends on the machine's UAC policy and can't be suppressed from the app.

## Autostart

The installer registers a **per-machine** autostart (HKLM `…\CurrentVersion\Run`)
so the tracker launches for *every* user in their interactive session — required
because idle detection (`GetLastInputInfo`) only sees input in an interactive
session. The app does not enable the per-user (HKCU) autostart plugin; the
single-instance guard makes a stray second launch harmless. Uninstall removes the
HKLM value.
