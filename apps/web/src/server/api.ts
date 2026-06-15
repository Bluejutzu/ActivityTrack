import "server-only";
import { Elysia } from "elysia";
import {
  activityUpdateSchema,
  clockodoSignalSchema,
  genesysSignalSchema,
} from "@activitytrack/shared";
import { convex, api, signalSecret } from "./convex";

/**
 * Dashboard-side write API (ElysiaJS, mounted into the Next.js App Router).
 *
 * These are the *ingress* endpoints for the three signal sources — the agent
 * heartbeat, the Genesys notifications relay, and the Clockodo webhook. They
 * validate the inbound payload and push it into Convex via the secret-guarded
 * server bridge. The outbound integration HTTP (Genesys/Clockodo polling and
 * fetching) lives in the Convex backend (`convex/integrations.ts`) and runs on
 * the Convex cron; the per-user `sync`/webhook re-pull paths here just delegate
 * to those Convex actions, so there's a single copy of that logic.
 *
 * Reactive *reads* stay on the Convex React client in the dashboard — this
 * layer never serves read models.
 *
 * Auth:
 *   - the agent heartbeat presents the bootstrap ingest key;
 *   - the webhook/notify endpoints present the webhook secret.
 */

function bearer(headers: Record<string, string | undefined>): string | null {
  const h = headers["authorization"];
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

function checkKey(provided: string | null, expected: string | undefined) {
  return !!expected && provided === expected;
}

export const app = new Elysia({ prefix: "/api" })
  .onError(({ error, set }) => {
    // Never leak internals; log server-side, return a terse message.
    console.error("[api] error:", error);
    set.status = 500;
    return { ok: false, error: "internal_error" };
  })
  .get("/health", () => ({ ok: true }))

  /**
   * POST /api/activity/update — desktop agent workstation heartbeat. The agent
   * only reports the workstation; telephony/time-tracking are fused server-side.
   */
  .post("/activity/update", async ({ body, headers, set }) => {
    if (!checkKey(bearer(headers), process.env.ACTIVITYTRACK_INGEST_KEY)) {
      set.status = 401;
      return { ok: false, error: "unauthorized" };
    }
    const parsed = activityUpdateSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { ok: false, error: "bad_request" };
    }
    const { employeeId, deviceIdle, idleSeconds } = parsed.data;
    const result = await convex.mutation(api.state.pushSignal, {
      secret: signalSecret(),
      employeeId,
      source: "agent",
      deviceIdle,
      idleSeconds,
    });
    return { ok: true, finalState: result.finalState };
  })

  /**
   * POST /api/integrations/genesys/notify — relay for Genesys notifications.
   * The optional WebSocket worker posts a normalized event here; we push it.
   */
  .post("/integrations/genesys/notify", async ({ body, headers, set }) => {
    if (!checkKey(bearer(headers), process.env.ACTIVITYTRACK_WEBHOOK_SECRET)) {
      set.status = 401;
      return { ok: false, error: "unauthorized" };
    }
    const parsed = genesysSignalSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { ok: false, error: "bad_request" };
    }
    const { employeeId, routingStatus, presence, wrapUp } = parsed.data;
    const result = await convex.mutation(api.state.pushSignal, {
      secret: signalSecret(),
      employeeId,
      source: "genesys",
      genesysRoutingStatus: routingStatus,
      genesysPresence: presence,
      genesysWrapUp: wrapUp,
    });
    return { ok: true, finalState: result.finalState };
  })

  /**
   * POST /api/integrations/genesys/sync — on-demand single-user pull. Delegates
   * to the Convex action, which fetches from Genesys and records health. Body:
   * { employeeId, genesysUserId }.
   */
  .post("/integrations/genesys/sync", async ({ body, headers, set }) => {
    if (!checkKey(bearer(headers), process.env.ACTIVITYTRACK_WEBHOOK_SECRET)) {
      set.status = 401;
      return { ok: false, error: "unauthorized" };
    }
    const b = body as { employeeId?: string; genesysUserId?: string };
    if (!b?.employeeId || !b?.genesysUserId) {
      set.status = 400;
      return { ok: false, error: "bad_request" };
    }
    return await convex.action(api.integrations.syncGenesys, {
      secret: signalSecret(),
      employeeId: b.employeeId,
      genesysUserId: b.genesysUserId,
    });
  })

  /**
   * POST /api/webhooks/clockodo — Clockodo time-tracking webhook
   * (entry.created/updated/stopped) or a pre-normalized push.
   *
   * Two shapes are accepted:
   *   1. A normalized ClockodoSignal ({ employeeId, working?, onBreak?, absent? })
   *      — when an adapter has already resolved the state.
   *   2. A raw event carrying { employeeId, clockodoUserId } — we delegate to the
   *      Convex action, which re-pulls the current entry + absences.
   */
  .post("/webhooks/clockodo", async ({ body, headers, query, set }) => {
    const secret =
      bearer(headers) ?? (query.secret as string | undefined) ?? null;
    if (!checkKey(secret, process.env.ACTIVITYTRACK_WEBHOOK_SECRET)) {
      set.status = 401;
      return { ok: false, error: "unauthorized" };
    }

    const raw = body as { employeeId?: string; clockodoUserId?: string };

    // Mode 2: re-pull from Clockodo for an authoritative snapshot.
    if (raw?.employeeId && raw?.clockodoUserId) {
      return await convex.action(api.integrations.refreshClockodo, {
        secret: signalSecret(),
        employeeId: raw.employeeId,
        clockodoUserId: raw.clockodoUserId,
      });
    }

    // Mode 1: normalized push.
    const parsed = clockodoSignalSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { ok: false, error: "bad_request" };
    }
    const { employeeId, working, onBreak, absent } = parsed.data;
    const result = await convex.mutation(api.state.pushSignal, {
      secret: signalSecret(),
      employeeId,
      source: "clockodo",
      clockodoWorking: working,
      clockodoBreak: onBreak,
      clockodoAbsent: absent,
    });
    return { ok: true, finalState: result.finalState };
  });

export type App = typeof app;
