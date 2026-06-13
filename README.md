# ActivityTrack

Lightweight, self-hosted activity monitoring for a small team of Windows
machines. A headless desktop agent reports whether the logged-in coworker is
actively using their PC (active vs. idle — **no screenshots, no keystroke
content**), a Convex backend validates and stores it, and a Next.js dashboard
lets IT and managers see who's working and for how long.

> ⚠️ **Workplace monitoring.** Deploy only on company-owned devices and tell
> staff it's running. Check local labor/privacy law before rolling out. The
> agent deliberately records *activity timing only* — never key content or
> screen contents.

## Monorepo layout

```
apps/
  desktop/      Headless Windows agent (Node + koffi). No UI. Ships as an installer.
  web/          Next.js + TS admin dashboard (login + RBAC).   [placeholder]
packages/
  backend/      Convex schema, validating /ingest endpoint, queries, auth/RBAC.
  shared/       Shared TS types + zod wire contract (agent ⇄ backend).
```

## How it works

1. **Agent** mints a per-device UUID in `%ProgramData%\ActivityTrack`, polls
   Win32 `GetLastInputInfo` for idle time, and POSTs small samples to Convex.
   Runs as a logon scheduled task (interactive session, normal privileges).
2. **Backend** authenticates the agent by shared key, re-validates every sample
   server-side, auto-registers new devices as `pending`, and rolls up daily
   active/idle stats.
3. **Dashboard** shows live status + daily stats behind a login, with roles:
   `it_admin` (IT — manage everything), `manager` (boss — manage people/views),
   `viewer`.

See [`PLAN.md`](./PLAN.md) for the full build plan and open decisions.

## Getting started

```bash
pnpm install
pnpm dev:backend   # convex dev (creates the deployment + env)
pnpm dev:desktop   # run the agent locally
pnpm dev:web       # dashboard (after it's bootstrapped — see apps/web/README.md)
```

Releases of the desktop installer are built by `.github/workflows/release.yml`
on every `v*` tag and attached to the GitHub Release.
