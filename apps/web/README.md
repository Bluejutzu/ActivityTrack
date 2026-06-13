# @activitytrack/web

The ActivityTrack admin dashboard — **Next.js (App Router) + TypeScript +
Tailwind**, with Convex for data/realtime and Convex Auth (password) for login.
UI is available in **German (default) and English**.

## Setup

```bash
# from repo root
pnpm install

# Point at your Convex deployment (from `pnpm dev:backend`):
echo 'NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud' > apps/web/.env.local

pnpm dev:web   # http://localhost:3000
```

The first account to register becomes `it_admin` automatically. Other accounts
default to `viewer` and can be promoted under **Users & roles**.

## Features / routes

- `/` — team overview: who's active right now + today's active time per person.
- `/devices` — device registry with the pending-approval queue; approve/disable
  (IT) and link a device to a person (manager+).
- `/people` — manage coworkers (manager+).
- `/users` — users & roles (IT only).
- `/audit` — privileged-action audit log (IT only).
- `/settings` — set the tracker debug-tool password (IT only).

RBAC is enforced **server-side** in Convex; the UI only mirrors it for
affordances. Types and the wire contract come from `@activitytrack/shared`;
the Convex API comes from `@activitytrack/backend`.
