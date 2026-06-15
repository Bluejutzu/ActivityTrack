# Fused Employee State (Genesys + Clockodo)

ActivityTrack's desktop agent only knows about the **workstation**, so it
mislabels people as *Idle* when they're actually on a Genesys call, doing
after-call work, on a Clockodo break, or absent. The backend is the single
source of truth: it fuses three independent signals into one normalized state.

## State model

Priority order (highest wins):

```
ABSENT → BREAK → IN_CALL → WRAP_UP → ACTIVE → IDLE
```

The engine is a pure function in `packages/shared/src/state.ts`
(`computeEmployeeState`), shared verbatim by the backend.

## Architecture

```
 Agent heartbeat ─┐
 Genesys WS ──────┼─► Elysia API (Next.js)  ──►  Convex state.pushSignal  ──►  employeeStates cache
 Clockodo webhook ┘        (write side)            (state engine + SoT)            │
                                                                                   ▼
                                                          Dashboard useQuery(state.overview)  (reactive)
```

- **Write side** = ElysiaJS, mounted at `apps/web/src/app/api/[[...slugs]]/route.ts`.
  Endpoints validate/normalize and push into Convex via a secret-guarded
  server-to-server mutation (`state.pushSignal`).
- **Read side** = Convex reactive queries (`state.overview`, `state.get`) on the
  dashboard (`/state`). Reactivity stays on Convex; Elysia never serves reads.
- **State cache** = `employeeStates` table; each source patches only its own
  columns, and `finalState` is recomputed on every write.

### Endpoints (Elysia)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/activity/update` | `Bearer ACTIVITYTRACK_INGEST_KEY` | Agent workstation heartbeat |
| POST | `/api/webhooks/clockodo` | `ACTIVITYTRACK_WEBHOOK_SECRET` | Clockodo entry.* webhook (re-pulls authoritative state) |
| POST | `/api/integrations/genesys/notify` | `ACTIVITYTRACK_WEBHOOK_SECRET` | Relay for normalized Genesys events |
| POST | `/api/integrations/genesys/sync` | `ACTIVITYTRACK_WEBHOOK_SECRET` | Polling fallback for one user |
| GET | `/api/health` | — | Liveness |

### Realtime updates

- **Clockodo** has outbound webhooks → `POST /api/webhooks/clockodo`
  (clock-in/out/break are pushed in realtime, day and night, no cron needed).
- **Genesys** has no webhooks; it pushes over a notifications WebSocket. Two ways
  to consume it:
  1. **Convex cron poll (default, no extra host)** — `internal.integrations.pollAll`
     (`packages/backend/convex/integrations.ts`) runs inside Convex and polls
     Genesys per user + refreshes Clockodo absences. Convex crons run on the
     **free tier** and can fire every minute (unlike Vercel Hobby crons, which
     are once-a-day). Nothing to self-host.
  2. **Realtime worker (optional upgrade)** — a standalone long-lived process
     (`apps/web/src/server/integrations/genesysWorker.ts`,
     `pnpm --filter @activitytrack/web worker:genesys`) that holds the WebSocket
     for instant updates. Use it only if you have somewhere to run a process.

#### Cron schedule

`packages/backend/convex/crons.ts` runs the poll every 2 minutes during business
hours on weekdays: `*/2 5-18 * * 1-5`. **Convex crons run in UTC** —
`05:00–18:59 UTC` maps to roughly `06:00–20:00` German time (CET/CEST). It does
not run at night or on weekends because nobody is on shift, and Clockodo
clock-ins still arrive via webhook regardless. Adjust the expression to your
hours/timezone.

The on-demand paths (`/api/integrations/genesys/sync`, and the Clockodo webhook
re-pull) delegate to the same Convex actions (`integrations.syncGenesys` /
`integrations.refreshClockodo`), so there is exactly one copy of the outbound
HTTP logic.

### Resilience (graceful degradation)

A source being down never breaks anything. The state engine treats a missing
signal as "no information" (not `false`), and `pushSignal` only ever patches the
columns a source actually sends — so the last-known values of the other sources
(and of the down source) are preserved. Integration failures are caught, recorded
in `integrationHealth`, and shown on the `/state` page as
"<source> unavailable: <reason>"; the fused state keeps working from whatever
signals remain.

## What you must set up outside the code

1. **Generate two secrets** (any long random strings):
   `ACTIVITYTRACK_SIGNAL_SECRET` and `ACTIVITYTRACK_WEBHOOK_SECRET`.
2. **Convex deployment env** (polling + outbound HTTP run here):
   ```
   npx convex env set ACTIVITYTRACK_SIGNAL_SECRET <secret>
   npx convex env set GENESYS_CLIENT_ID <id>
   npx convex env set GENESYS_CLIENT_SECRET <secret>
   npx convex env set GENESYS_REGION mypurecloud.de
   npx convex env set CLOCKODO_API_USER <email>
   npx convex env set CLOCKODO_API_KEY <key>
   npx convex env set CLOCKODO_BREAK_SERVICE_IDS <id,id>   # optional
   ```
   Then push the schema/functions: `npx convex deploy` (or `convex dev`) to apply
   the new `employeeStates` / `integrationHealth` tables, the `people` mapping
   fields, and the poll cron.
3. **Web app env** (`.env.local` / Vercel): `ACTIVITYTRACK_SIGNAL_SECRET` (same
   value as Convex) and `ACTIVITYTRACK_WEBHOOK_SECRET`. That's all the dashboard
   layer needs — it no longer calls Genesys/Clockodo directly.
4. **Genesys OAuth client:** create a *Client Credentials* OAuth app in Genesys
   Admin with read scopes for **Presence, Routing Status, Conversations, Users**;
   put its id/secret in the **Convex** env. Set `GENESYS_REGION` to your org's region.
5. **Clockodo:** get the API key (Clockodo → Personal data → API), and note the
   service id(s) you use for breaks → `CLOCKODO_BREAK_SERVICE_IDS`. Configure a
   Clockodo webhook pointing at `https://<dashboard>/api/webhooks/clockodo`
   (send the webhook secret as `Authorization: Bearer <secret>` or `?secret=`).
   Include `employeeId` + `clockodoUserId` in the webhook body for the re-pull
   path, or post a normalized `{ employeeId, working, onBreak, absent }`.
6. **Map people:** in the dashboard → *People*, fill each person's
   **Employee ID** (the canonical key, also what the agent sends), **Genesys ID**,
   and **Clockodo ID**.
7. **Realtime for Genesys:** nothing to do — the Convex cron polls automatically
   during business hours. Tune the schedule/timezone in
   `packages/backend/convex/crons.ts` (see "Cron schedule"). *Optional* instant
   updates: run `pnpm --filter @activitytrack/web worker:genesys` as a persistent
   process with `NEXT_PUBLIC_CONVEX_URL`, `ACTIVITYTRACK_SIGNAL_SECRET`, and the
   `GENESYS_*` vars in its env.
8. **Point the desktop agent** at `POST /api/activity/update` with the
   `{ employeeId, deviceIdle, idleSeconds, timestamp }` payload and the
   `ACTIVITYTRACK_INGEST_KEY` bearer (or keep the existing `/ingest` path; the
   new endpoint is additive).
