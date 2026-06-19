# ActivityTrack — Ultrareview & Hardening

A full review of both apps (desktop tracker, web dashboard) and the Convex
backend: edge cases, failsafes, configuration that needs the repo owner present,
idiomatic-code notes, UI/UX, and a desktop framework / future-proofing verdict.

Each finding is tagged **severity** (`critical` / `important` / `nice-to-have`)
and **owner?** (does fixing it require the repo owner — secrets, infra, a product
decision — or could it be done in-repo). Items marked **[fixed]** were addressed
in this change; **[flagged]** are intentionally left for the owner with the
recommendation written out.

---

## 0. Executive summary

ActivityTrack is **well-architected for what it is**: a single-tenant, ~10-user
internal monitoring tool. The trust boundary holds (the agent is a dumb sender;
all validation is server-side in Convex), RBAC is enforced server-side, device
keys are hashed with a constant-time compare, ingest validates clock skew, there's
an append-only audit log, a crash-safe offline queue on the agent, and a signed
Tauri auto-updater. The gaps are **hardening, not architecture** — and the
desktop framework choice (Tauri 2) is correct and should be kept.

Several findings from the initial automated pass were **wrong or overstated**;
they're corrected in §1 so nobody wastes time "fixing" non-bugs.

---

## 1. Corrections to the initial automated review

| Claim | Reality |
|---|---|
| "Autostart is broken on Windows (`MacosLauncher::LaunchAgent`)" | **False.** That enum only selects the macOS backend; on Windows `tauri-plugin-autostart` writes the registry Run key regardless. The real nuance is that the Run key is **HKCU (per-user)** — see §3 D6. |
| "orgId multi-tenancy data leak (critical)" | **N/A.** The app is explicitly single-tenant (`README.md`). The `orgId` columns are vestigial; no leak. |
| "No version sync across the 3 files" | **Already automated** by `scripts/bump-version.js`. Only manual edits can drift — now guarded by `scripts/check-version-sync.js`. |
| "Queue corruption is critical" | **Overstated.** `queue.rs::read_all` tolerates torn lines (`filter_map(...ok())`). The real issue was a non-atomic rewrite — now fixed (§3 D3). |
| "No provisioning retry button (web)" | **Already present** — `AppShell.tsx` renders `AuthErrorPanel` with a wired retry button and `auth.error.retry` strings. |
| "Clockodo webhook leaks the secret to stdout" | **By design.** The validation-handshake log is *how* the operator retrieves the value to paste into Clockodo. It fires only on the handshake, not per event. Treat deploy logs as sensitive during setup (§2). |

---

## 2. Configuration hard to fix without the owner — FAQ / operator runbook

Everything here needs a human with the right secrets/console; none of it can be
inferred from the repo.

### Convex deployment env vars (`npx convex env set …`)
| Var | What breaks if unset | Notes |
|---|---|---|
| `ACTIVITYTRACK_INGEST_KEY` | Agent enrollment + bootstrap verify fail | Long random secret; also baked into the installer at release time. |
| `CLERK_JWT_ISSUER_DOMAIN` | Dashboard sign-in fails | Must pair with a Clerk JWT template named **`convex`**. |
| `ACTIVITYTRACK_ADMIN_EMAILS` | Bootstrap rule kicks in | Permanent `it_admin`s, immune to lockout. **Set before first sign-in**, or the first account to sign in becomes `it_admin`. |
| `ACTIVITYTRACK_SIGNAL_SECRET` | All server→Convex signal writes rejected | Now also warned at web boot (§4 W1). |
| `GENESYS_CLIENT_ID` / `_SECRET` / `GENESYS_REGION` | Genesys integration disabled (gracefully) | Region defaults to `mypurecloud.de`. |
| `CLOCKODO_API_USER` / `CLOCKODO_API_KEY` / `CLOCKODO_BASE_URL` | Clockodo integration disabled (gracefully) | Base defaults to `https://my.clockodo.com`. |

### Web (Vercel) env
`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`ACTIVITYTRACK_SIGNAL_SECRET`, `ACTIVITYTRACK_INGEST_KEY`,
`ACTIVITYTRACK_WEBHOOK_SECRET`, `CLOCKODO_WEBHOOK_TOKEN`.

### GitHub release secrets (installer + auto-update)
`ACTIVITYTRACK_CONVEX_URL`, `ACTIVITYTRACK_INGEST_KEY`,
`ACTIVITYTRACK_CLERK_PUBLISHABLE_KEY` (repo *var*),
`TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

> **Signing-key rule (critical, owner-only).** The updater public key in
> `tauri.conf.json` must forever match the CI private key. If the private key is
> lost or rotated without re-issuing installs, **every deployed agent stops being
> able to auto-update** (signature verification fails). Back the private key up
> in a password manager / secret vault now, and document a rotation plan
> (rotation requires shipping a build signed with the *old* key that trusts the
> *new* key, or re-installing agents). See §3 D8.

> **Secret-in-installer trade-off (owner decision).** The release workflow bakes
> `convexUrl` + `ingestKey` into the NSIS installer's `config.json` for zero-touch
> install. That means the bootstrap key lives in the distributed `.exe`. This is
> acceptable for an internal, company-owned-device tool, and the key only allows
> *enrollment* (per-device keys are minted server-side). The alternative —
> IT placing `config.json` by hand — is already supported (the NSIS hook won't
> overwrite an existing file). Keep as-is unless distribution widens. See §5 X1.

---

## 3. Desktop tracker (Tauri + Rust)

### Edge cases & failsafes
- **D1 — Single-instance enforcement** · *important · owner? no* · **[fixed]**
  No guard existed; a second launch (another user session via the per-user Run
  key, or a stray double-start) ran a **duplicate tracker against the same
  `device-id`**, double-counting samples. Added `tauri-plugin-single-instance`
  (registered first) — a second launch now just surfaces the running window.
- **D2 — Mutex-poison cascade** · *important · owner? no* · **[fixed]**
  Seven `.lock().expect("…poisoned")` sites under `panic = "abort"` meant one
  panic could abort the whole agent. Switched to
  `.lock().unwrap_or_else(|e| e.into_inner())` to recover the guard.
- **D3 — Non-atomic queue rewrite** · *important · owner? no* · **[fixed]**
  `queue.rs::replace` did an in-place `fs::write` (truncate + write); a crash or
  full disk mid-write could lose pending samples. Now writes a temp file and
  `fs::rename`s over the target (atomic, incl. Windows via `MOVEFILE_REPLACE_EXISTING`).
- **D4 — No persistent log** · *important · owner? no* · **[fixed]**
  A hidden tray app had nowhere to print; errors lived only in an in-memory ring
  + `eprintln!`. Added a size-capped (512 KB, 1 rotation) `agent.log` in
  `%ProgramData%\ActivityTrack`, fed by `push_error`/`report_event`. (`PLAN.md:87`
  asked for this.)
- **Idle detection** · *ok* · `idle.rs` correctly handles 32-bit tick wraparound
  and is session-scoped (interactive session only — a service would read "idle").
- **Sender** · *ok* · hard timeouts on every call; no retry, but the persistent
  queue + 30s flush is the retry, and the `fail_streak` gate avoids alert spam.
  Clock-skew is handled server-side (correct — trust boundary).

### Future-proofing / auto-update
- **D5 — Startup-only update check** · *nice-to-have · owner? no* · **[fixed]**
  A tray app stays up for days; added a 6-hourly re-check so long-running
  machines don't stall on an old build.
- **D6 — Autostart is per-user (HKCU)** · *important · owner? yes (decision)* · **[flagged]**
  Autostart works on Windows, but via the **HKCU** Run key, so on a multi-user
  machine it only auto-starts for the user who first ran it; the originally
  planned **per-machine logon scheduled task** is *not* implemented (the NSIS hook
  only writes `config.json`). **Decision:** keep per-user RunKey (simplest, and
  one tracker per interactive session is actually correct for idle detection), or
  add a per-machine scheduled-task registration in `installer.nsh` if you need
  tracking the moment *any* user logs in. Recommended: keep RunKey; document that
  the agent starts on that user's next logon.
- **D7 — Version-sync guard** · *nice-to-have · owner? no* · **[fixed]**
  Added `scripts/check-version-sync.js` (+ a release-workflow step) to fail the
  build if the three version files ever drift or mismatch the tag.
- **D8 — Signing-key continuity** · *critical · owner? yes* · **[flagged]**
  See the signing-key rule in §2. Back up the key and write a rotation plan.

### Idiomatic code
Strong `Result`-based error handling, minimal/contained `unsafe` FFI, allocation-
light loop. The `Outcome` taxonomy (`not_configured`/`network`/`server`/auth) is
a genuinely nice touch for field debugging.

### UI/UX
Clean tray panels, 5-state error/loading handling, German+English complete,
non-blocking startup. Minor: no ARIA on a few controls (internal tool — low
priority).

---

## 4. Web dashboard (Next.js + Clerk + Convex)

- **W1 — Secret validated lazily** · *important · owner? no* · **[fixed]**
  `ACTIVITYTRACK_SIGNAL_SECRET` previously only blew up on the first signal push.
  Added a boot-time warning at module load (parallel to the existing
  `NEXT_PUBLIC_CONVEX_URL` one); `signalSecret()` still hard-throws on use so
  requests fail closed. (A hard top-level throw is available if you'd rather fail
  the route entirely — left as a one-line flip.)
- **W3 — People page had no empty state** · *nice-to-have · owner? no* · **[fixed]**
  Added a localized "No people added yet" row (parity with devices/overview).
- **W4 — Slot revoke fired instantly** · *nice-to-have · owner? no* · **[fixed]**
  Now routed through the existing `ConfirmDialog`.
- **W5 — API errors only hit stdout** · *important · owner? no* · **[fixed]**
  Added a secret-guarded `events.logFromServer` mutation and wired the Elysia
  `onError` (best-effort) to surface API/integration 500s on the System Health
  page. Kept the by-design Clockodo handshake log (see §1).
- **W6 — i18n is one ~700-line module** · *nice-to-have · owner? no* · **[flagged]**
  Fine for two languages; split `lib/i18n.tsx` into `de`/`en` modules before a
  third language or external translators arrive.

**Idiomatic / UX, otherwise:** consistent `useQuery`/`QueryState` loading model,
clean shadcn-style primitives, no-flash dark mode, server-side RBAC mirrored in
the UI for affordances, good empty/skeleton states elsewhere. Client-side role
checks are for affordances only — real enforcement is server-side (verified).

---

## 5. Convex backend (the trust boundary)

- **B1 — Bootstrap/signal keys compared with `!==`** · *important · owner? no* · **[fixed]**
  The device-key path used constant-time `safeEqual`, but the bootstrap key
  (`http.ts`) and signal secret (`state.ts`) used plain `!==`. High-entropy keys
  make the timing risk marginal, but consistency matters — `safeEqual` is now
  exported and used on all three.
- **B2 — Day-boundary rollup mis-attribution** · *important · owner? no* · **[fixed]**
  A gap that straddled local midnight credited the *whole* interval to the end
  day. `accrueDaily` now splits the interval at the local-day boundary so each
  day gets its real share.
- **B3 — No ingest rate limit** · *important · owner? yes (threshold)* · **[fixed, threshold flagged]**
  A leaked device key could flood writes. Added a per-device minimum spacing
  (`MIN_INGEST_INTERVAL_MS`, default 3 s — far below the 30 s flush) that returns
  **429** (agent keeps the batch and retries, so no legit data is lost) and writes
  nothing during a flood. **Tune the threshold** if you change the agent cadence.
- **B4 — No sample idempotency** · *important · owner? yes (data model)* · **[flagged]**
  Re-sent batches can double-count. The agent only removes from its queue after a
  confirmed 200, so this needs a lost-ack to trigger — rare. Recommended minimal
  fix: before insert, check the existing `by_device_time` index for
  `(deviceId, capturedAt)` and skip duplicates (also skip their accrual). Left
  unfixed to avoid a subtle behavior change without your sign-off.
- **B5 — Unbounded list queries** · *nice-to-have · owner? no* · **[fixed]**
  `devices.list` / `people.list` / `state.overview` used `.collect()`; added
  defensive `.take(2000)` caps (ample for current scale, bounded for growth).
- **Security posture, otherwise:** PBKDF2-SHA256 (100k) password hashing, hashed
  device keys, indexed reads (no full scans on hot paths), bounded retention
  crons, append-only audit log, sane first-admin bootstrap. Solid.

---

## 6. What was changed in this PR (summary)

**Desktop:** single-instance plugin (D1); mutex-poison recovery (D2); atomic queue
rewrite (D3); size-capped `agent.log` (D4); 6-hourly update re-check (D5);
`check-version-sync.js` + release step (D7).
**Backend:** constant-time key/secret compares (B1); local-day rollup split (B2);
per-device ingest rate limit → 429 (B3); `.take()` caps (B5);
`events.logFromServer` (for W5).
**Web:** boot-time signal-secret warning (W1); people empty state (W3); slot-revoke
confirm (W4); API errors surfaced to System Health (W5); i18n keys for the above.

**Left for the owner (flagged):** D6 autostart scope, D8 signing-key continuity,
B4 sample idempotency, W6 i18n split, X1 installer-secret model.
