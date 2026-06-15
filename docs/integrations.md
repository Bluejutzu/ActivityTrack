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

- **Clockodo** has outbound webhooks → `POST /api/webhooks/clockodo`.
- **Genesys** has no webhooks; it pushes over a notifications WebSocket. The
  subscriber is a standalone long-lived worker
  (`apps/web/src/server/integrations/genesysWorker.ts`,
  `pnpm --filter @activitytrack/web worker:genesys`) that creates a channel,
  subscribes to each tracked user's topics, and pushes events into Convex.

## What you must set up outside the code

1. **Generate two secrets** (any long random strings):
   `ACTIVITYTRACK_SIGNAL_SECRET` and `ACTIVITYTRACK_WEBHOOK_SECRET`.
2. **Convex deployment env:** `npx convex env set ACTIVITYTRACK_SIGNAL_SECRET <secret>`
   (also push the schema: `npx convex deploy` / `convex dev` to apply the new
   `employeeStates` table + `people` mapping fields).
3. **Web app env** (`.env.local` / hosting env): `ACTIVITYTRACK_SIGNAL_SECRET`,
   `ACTIVITYTRACK_WEBHOOK_SECRET`, `GENESYS_CLIENT_ID`, `GENESYS_CLIENT_SECRET`,
   `GENESYS_REGION`, `CLOCKODO_API_USER`, `CLOCKODO_API_KEY`,
   `CLOCKODO_BREAK_SERVICE_IDS` (see `.env.example`).
4. **Genesys OAuth client:** create a *Client Credentials* OAuth app in Genesys
   Admin with read scopes for **Presence, Routing Status, Conversations, Users**;
   put its id/secret in the env. Set `GENESYS_REGION` to your org's region.
5. **Clockodo:** get the API key (Clockodo → Personal data → API), and note the
   service id(s) you use for breaks → `CLOCKODO_BREAK_SERVICE_IDS`. Configure a
   Clockodo webhook pointing at `https://<dashboard>/api/webhooks/clockodo`
   (send the webhook secret as `Authorization: Bearer <secret>` or `?secret=`).
   Include `employeeId` + `clockodoUserId` in the webhook body for the re-pull
   path, or post a normalized `{ employeeId, working, onBreak, absent }`.
6. **Map people:** in the dashboard → *People*, fill each person's
   **Employee ID** (the canonical key, also what the agent sends), **Genesys ID**,
   and **Clockodo ID**.
7. **Run the Genesys worker** as a persistent process (host it wherever you can
   keep a process alive — a small VM, container, or `pm2`):
   `pnpm --filter @activitytrack/web worker:genesys` with `NEXT_PUBLIC_CONVEX_URL`,
   `ACTIVITYTRACK_SIGNAL_SECRET`, and the `GENESYS_*` vars in its env.
8. **Point the desktop agent** at `POST /api/activity/update` with the
   `{ employeeId, deviceIdle, idleSeconds, timestamp }` payload and the
   `ACTIVITYTRACK_INGEST_KEY` bearer (or keep the existing `/ingest` path; the
   new endpoint is additive).
