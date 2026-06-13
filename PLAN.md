# ActivityTrack — Implementation Plan

> Self-contained brief for a cloud agent. The repo is scaffolded (structure,
> configs, skeletons). This plan describes what to build to completion. Skeleton
> files referenced below already exist and have `TODO`s where work goes.

> **Build addendum (decisions made during implementation).** The desktop
> tracker was changed from the originally-planned headless Node agent to a
> **Tauri app** that *is* the tracker: it runs in Rust, lives in the system
> tray, starts **hidden** at logon, and POSTs samples to Convex exactly like the
> Node agent would have. Its UI is **locked behind a password set in the
> dashboard** (hashed in Convex `settings`, verified via the keyed
> `/agent/verify-password` endpoint) and shows status + local debug info. The
> separate Phase-4 Tauri "debug tool" is therefore folded into this one app.
> Both the **dashboard and the tracker UI ship German (default) + English**.
> Auth is **Convex Auth (password)**; raw-sample retention is **90 days**;
> sampling defaults are unchanged. The trust boundary is unchanged — all
> validation is server-side in Convex.

## Context

A small company (~10 coworkers, must scale up) wants to run its **own**
lightweight activity-monitoring tool on company Windows PCs instead of paying
for proprietary tools (ActivTrak / Hubstaff style). Goal: let the boss and IT
see **whether a coworker is actively using their PC and for how long during the
day** — active vs. idle only. **No screenshots. No keystroke content.** We
detect *input timing*, not *input data*, so this is privacy-respecting and not a
keylogger.

Two deliverables in one monorepo:

1. **Desktop agent** — ultra-light, headless (no UI), Windows-only, **not
   Electron**. Just sends data to Convex. Mints a unique per-device id stored in
   `%ProgramData%`. Distributed as a **Windows installer** via GitHub Releases.
2. **Web dashboard** — Next.js + TS. Validates/displays the data behind a login,
   with multiple access levels (IT vs. boss).

**Trust boundary (hard requirement):** the desktop app does **zero** business
validation — it's a dumb sender. *All* validation happens server-side in Convex.

## Architecture

```
Windows PC                          Convex (cloud)                 Browser
┌───────────────────┐   HTTPS POST  ┌──────────────────┐  reactive ┌──────────────┐
│ ActivityTrack      │  /ingest      │ http.ts (auth +   │  queries  │ Next.js       │
│ agent (headless)   │ ─────────────▶│ zod validate)     │◀─────────▶│ dashboard     │
│ - device UUID      │  Bearer key   │ → mutations        │           │ login + RBAC  │
│ - GetLastInputInfo │               │ schema.ts tables   │           │ live + stats  │
│ - bounded queue    │               │ daily rollups      │           └──────────────┘
└───────────────────┘               └──────────────────┘
```

Shared wire contract lives in `packages/shared` (zod schema) and is imported by
**both** the agent and the backend, so the client can't drift from the
server's validation.

## Data sent by the agent (per sample)

Defined in `packages/shared/src/index.ts` (`activitySampleSchema`):
`deviceId` (UUID), `windowsUser` (the locked-in Windows account), `hostname`,
`idleMs`, `active` (bool), `capturedAt`, `tzOffsetMinutes`, `agentVersion`,
`platform`. Server adds `receivedAt`. Extend here if more signal is wanted
(e.g. coarse foreground-app category) — but never anything content-bearing.

---

## Phase 1 — Desktop agent (`apps/desktop`)

Skeleton already in place: `src/{paths,device,idle,config,queue,sender,index}.ts`.

- [ ] **Idle detection** (`src/idle.ts`): verify the `koffi` binding to
  `user32!GetLastInputInfo` + `kernel32!GetTickCount` returns sane `idleMs` on
  Windows; handle the 32-bit tick wraparound (already stubbed).
- [ ] **Device id** (`src/device.ts`): already mints/persists a UUID in
  `%ProgramData%\ActivityTrack\device-id`. Confirm the installer ACLs that dir
  so non-admins can't trivially rewrite it.
- [ ] **Main loop** (`src/index.ts`): poll → build sample → enqueue → periodic
  flush. Keep it allocation-light; no growing in-memory arrays.
- [ ] **Bounded queue** (`src/queue.ts`): JSONL on disk, capped at
  `maxQueueSize`, oldest dropped first (already stubbed). This is the
  memory/disk-overflow guard the user explicitly asked for — keep it.
- [ ] **Sender** (`src/sender.ts`): POST batch to `${convexUrl}/ingest` with the
  bearer key and a hard request timeout (stubbed). Keep batch on failure.
- [ ] **Config** (`src/config.ts`): file in `%ProgramData%` overrides env. The
  installer should drop a `config.json` with `convexUrl` + `ingestKey`.
- [ ] **Logging**: tiny rotating log to `%ProgramData%\ActivityTrack\agent.log`
  (size-capped — do not let it grow unbounded).
- [ ] **Resilience**: top-level catch + the scheduled task restarts on logon. No
  unhandled-rejection crashes.

### Packaging / distribution (installer for GitHub Releases)

- [ ] `tsup` bundle → `dist/index.js` (config exists; `koffi` kept external).
- [ ] `scripts/build-installer.mjs` stages a **pinned `node.exe`** + `dist/` +
  `node_modules/koffi` into `installer/staging/`, then runs `iscc`.
  - Bundling a portable `node.exe` (vs. SEA single-exe) is recommended because
    `koffi` ships a native `.node` that's awkward to embed in a SEA. Revisit SEA
    only if a true single-file exe is required.
- [ ] `installer/activitytrack.iss` (exists) installs to Program Files and
  registers a **logon scheduled task** at normal privileges.
  - **Why a scheduled task, not a Windows service:** `GetLastInputInfo` only
    sees input in the *interactive* session. A session-0 service would always
    read "idle". This is a correctness requirement, not a preference.
- [ ] `.github/workflows/release.yml` (exists) builds the installer on `v*` tags
  and attaches `*.exe` to the Release.

---

## Phase 2 — Convex backend (`packages/backend`)

Skeleton: `convex/schema.ts`, `convex/http.ts`.

- [ ] `convex dev` once to generate `convex/_generated` (gitignored).
- [ ] **`/ingest`** (`convex/http.ts`): finish the handler — (1) bearer-key
  check vs `ACTIVITYTRACK_INGEST_KEY`, (2) zod validate via `ingestPayloadSchema`
  (done), (3) **clock-skew sanity** (drop/clamp samples whose `capturedAt` is
  implausibly far from server `now()`), (4) call an internal mutation.
- [ ] **`recordSamples` mutation**: insert into `activitySamples`; upsert the
  `devices` row (auto-register unknown `deviceId` as `pending`, update
  `lastSeen`/`lastWindowsUser`); ignore samples from `disabled` devices.
- [ ] **Daily rollups**: maintain `dailyStats` (activeSeconds/idleSeconds per
  device per local day) — incrementally in the mutation or via a scheduled
  cron. The dashboard reads rollups, not the raw firehose.
- [ ] **Queries** (RBAC-gated): list devices (+ pending), live status per
  person/device, daily/range stats, audit log.
- [ ] **Admin mutations**: approve/disable device, link device→person, CRUD
  people, set user roles — each writes an `auditLog` entry.
- [ ] **Retention**: cron to prune raw `activitySamples` older than N days
  (rollups persist) — keeps the table bounded.

---

## Phase 3 — Web dashboard (`apps/web`)

Currently a placeholder (`apps/web/README.md` has the bootstrap command).

- [ ] Bootstrap: `pnpm create next-app@latest apps/web --ts --app --tailwind
  --eslint --src-dir --use-pnpm`; add `convex` + chosen auth provider.
- [ ] Wire Convex provider + `@activitytrack/shared` types.
- [ ] **Auth + RBAC** (see open question): login gate; roles `it_admin` >
  `manager` > `viewer`.
  - **IT (`it_admin`)**: manage users/roles/permissions, approve/disable
    devices, set the debug-tool password, everything.
  - **Boss (`manager`)**: add/edit people, link devices, view all stats.
  - **`viewer`**: read-only dashboards.
  - Enforce roles **server-side** in Convex (never trust the client), mirrored
    in the UI for affordances.
- [ ] **Views**: team overview (who's active right now + today's active time per
  person, shown like `Working (3h 42m today)`); per-person timeline; device
  registry with pending-approval queue; users & roles admin (IT only); audit
  log (IT only).
- [ ] Use `frontend-design` skill sensibilities — clean, legible, real-time.

---

## Phase 4 — Optional / later

- [ ] **Debug tool on PCs (Tauri).** User mentioned wanting a small password-
  locked tool to inspect/debug what a PC is sending. Build as a **Tauri** app
  (lightweight, not Electron) under `apps/desktop-debug`, gated by a password
  **set from the IT dashboard** (store a hash in Convex `settings`; the tool
  fetches/verifies). Read-only view of the local queue + last-sent samples.
- [ ] **ClockOodle integration.** ⚠️ **Research first** — confirm whether
  ClockOodle exposes a *free* REST API (web searches were not completed in this
  session). If yes: sync attendance/time entries into Convex and correlate with
  activity (e.g. flag "clocked in but idle all afternoon"). If no free API, skip
  and document.

---

## Open decisions (please confirm; sensible defaults chosen)

1. **Auth provider** — *default: Convex Auth (password)* to keep everything in
   our own Convex deployment ("save it on our own"). Alternative: **Clerk**
   (faster, nicer UX, free for 10 users, but external). A Clerk MCP is
   available if we go that route.
2. **Package manager** — using **pnpm** workspaces (installed locally). Switch
   to npm workspaces if the cloud environment prefers it.
3. **Sampling cadence** — default poll 15s, idle threshold 60s, flush 30s. Tune
   in `config.ts` defaults.
4. **Raw-sample retention** — default prune after 90 days; confirm.

## Verification (end-to-end)

1. `pnpm install` at root succeeds; `pnpm -r typecheck` is clean.
2. `pnpm dev:backend` (`convex dev`) provisions a dev deployment; set
   `ACTIVITYTRACK_INGEST_KEY` in Convex env.
3. Create a `config.json` in `%ProgramData%\ActivityTrack` with the dev
   `convexUrl` + key; run `pnpm dev:desktop`. Confirm: a `device-id` file
   appears, samples POST `200`, and a `devices` row shows up as `pending` in the
   Convex dashboard.
4. Move the mouse / leave it idle past the threshold; confirm `active` flips and
   `dailyStats` accrues active vs idle seconds correctly.
5. Tag `v0.1.0`, push; confirm the release workflow produces an installer `.exe`.
   Install on a clean Windows VM; confirm the logon task runs the agent headless
   and it reports in.
6. In the dashboard: log in as `it_admin`, approve the device, link it to a
   person; log in as `manager` and confirm role limits; verify the team view
   shows live status + today's active time.

## Non-goals / guardrails

- No screenshots, no key-content capture, no clipboard/file snooping — activity
  timing only.
- Agent stays headless and tiny; no Electron.
- Bounded memory & disk everywhere (queue cap, log rotation, sample retention).
- Company-owned devices + staff disclosure assumed; surface the privacy note in
  the dashboard footer.
