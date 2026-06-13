# @activitytrack/web

**Status: placeholder.** This is the Next.js admin dashboard. It has not been
scaffolded yet — see [`PLAN.md`](../../PLAN.md) → *Phase 3: Web dashboard* for
the bootstrap command and feature list.

Quick start (during implementation):

```bash
# from repo root
pnpm create next-app@latest apps/web --ts --app --tailwind --eslint --src-dir --use-pnpm
pnpm --filter @activitytrack/web add convex
# + chosen auth provider (Convex Auth or Clerk — see PLAN open question)
```

The dashboard reads from `@activitytrack/backend` (Convex) and shares wire types
from `@activitytrack/shared`.
