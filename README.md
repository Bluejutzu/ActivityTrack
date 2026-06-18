# ActivityTrack

Lightweight, self-hosted activity monitoring for a small team of Windows
machines. A tray-resident desktop tracker reports whether the logged-in
coworker is actively using their PC (active vs. idle — **no screenshots, no
keystroke content**), a Convex backend validates and stores it, and a Next.js
dashboard lets IT and managers see who's working and for how long.

> ⚠️ **Workplace monitoring.** Deploy only on company-owned devices and tell
> staff it's running. Check local labor/privacy law before rolling out. The
> tracker deliberately records *activity timing only* — never key content or
> screen contents.

## Monorepo layout

```
apps/
  desktop/      Tray-resident Windows tracker (Tauri + Rust). Hidden on startup,
                UI locked behind a dashboard-set password. Ships as an installer.
  web/          Next.js + TS admin dashboard (login + RBAC, German/English).
packages/
  backend/      Convex schema, validating /ingest endpoint, queries, auth/RBAC.
  shared/       Shared TS types + zod wire contract (tracker ⇄ backend).
```

## How it works

1. **Tracker** (Tauri) mints a per-device UUID in `%ProgramData%\ActivityTrack`,
   polls Win32 `GetLastInputInfo` for idle time, and POSTs small samples to
   Convex. It launches at logon (interactive session — required for idle
   detection), lives in the system tray, and starts **hidden**. Opening it
   shows a status/debug panel **locked behind a password set in the dashboard**.
   German and English are both available.
2. **Backend** authenticates the tracker by shared key, re-validates every
   sample server-side, auto-registers new devices as `pending`, and rolls up
   daily active/idle stats. The tracker does **zero** business validation.
3. **Dashboard** shows live status + daily stats behind a login, with roles:
   `it_admin` (IT — manage everything), `manager` (boss — manage people/views),
   `viewer` (read-only). UI in German (default) or English.

## Who can access the dashboard

Clerk owns sign-in; access is decided server-side (single-tenant, no Clerk orgs):

- **Admins** are pinned in the `ACTIVITYTRACK_ADMIN_EMAILS` Convex env var. These
  emails are always `it_admin` and can never be locked out. Set once (Convex
  dashboard → Settings → Environment Variables) — this is the durable root of
  trust, so keep at least one boss's email here.
- **Everyone else** can sign in only if their email **domain** is on the
  allow-list, which any admin edits in the app under **Settings → Access** (no
  redeploy, no developer). They get the `viewer` role; admins can promote to
  `manager` under Settings → Users.
- Removing a domain (or an admin email) revokes that access on the person's next
  load. Clearing the domain list leaves only the admins — it can't lock them out.

See [`PLAN.md`](./PLAN.md) for the full build plan and decisions.

## Getting started

```bash
pnpm install

# 1. Backend — provisions a Convex dev deployment and generates convex/_generated
pnpm dev:backend
#    Then set the deployment env vars:
#      npx convex env set ACTIVITYTRACK_INGEST_KEY <a-long-random-secret>
#    Auth is handled by Clerk. Create a Clerk app, add a JWT template named
#    "convex", then point the backend at the Clerk issuer:
#      npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev

# 2. Web dashboard — in apps/web/.env.local set NEXT_PUBLIC_CONVEX_URL plus the
#    Clerk keys (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY); see
#    .env.example. Then:
pnpm dev:web
#    Set the permanent admins (always full access, can't be locked out):
#      npx convex env set ACTIVITYTRACK_ADMIN_EMAILS "you@company.com, boss@company.com"
#    If you skip this, the first account to sign in becomes it_admin (bootstrap).
#    Set the tracker debug password under Settings.

# 3. Tracker — create %ProgramData%\ActivityTrack\config.json with the Convex
#    URL + ingest key (the installer does this for you), then on Windows:
pnpm --filter @activitytrack/desktop tauri:dev
```

## Releases

`.github/workflows/release.yml` builds the Windows tracker installer (Tauri /
NSIS) on every `v*` tag and attaches it to the GitHub Release.

**Before your first release:** Set these GitHub repository secrets so the
installer is pre-configured:

```bash
gh secret set ACTIVITYTRACK_CONVEX_URL --body "https://<deployment>.convex.cloud"
gh secret set ACTIVITYTRACK_INGEST_KEY --body "<a-long-random-secret>"
```

These values are injected into the installer's `config.json` at build time (stored
securely in GitHub, never exposed in logs or the source repo). When users install
the `.exe`, the configuration is ready—no manual setup needed.

## Verification status

`pnpm -r typecheck` is clean; the Rust tracker passes `cargo check` and the web
dashboard builds with `next build`. The Windows-only syscalls (idle detection,
timezone) compile in the Windows release job, and the installer `.exe` is
produced there — they can't be built from a Linux dev box.
