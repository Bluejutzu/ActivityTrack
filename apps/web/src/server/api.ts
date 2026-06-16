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

/**
 * Clockodo echoes the value configured in its webhook "Token" field back in
 * every event body. Accept it against the dedicated token or — for setups that
 * reuse one secret — the shared webhook secret.
 */
function clockodoTokenOk(token: string | null): boolean {
  if (!token) return false;
  return (
    checkKey(token, process.env.CLOCKODO_WEBHOOK_TOKEN) ||
    checkKey(token, process.env.ACTIVITYTRACK_WEBHOOK_SECRET)
  );
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
    return await convex.action(api.genesys.syncGenesys, {
      secret: signalSecret(),
      employeeId: b.employeeId,
      genesysUserId: b.genesysUserId,
    });
  })

  /**
   * POST /api/webhooks/clockodo — Clockodo time-tracking webhook.
   *
   * Accepts the shapes Clockodo actually sends, plus two legacy adapter shapes:
   *
   *   A. Validation handshake — on create / URL change Clockodo POSTs
   *      `{ "secret": "<uuid>" }`. We log the secret (read it from the deploy
   *      logs and paste it into Clockodo's "Token" field) and return 200 so
   *      validation passes.
   *   B. Native event — `{ event_name: "entry.*", payload: { entry: { id } },
   *      token }`. Clockodo sends only the entry id, so we hand it to Convex,
   *      which fetches the entry, resolves the user, and re-pulls their state.
   *      Authenticated by the echoed `token`.
   *   C. Legacy — a normalized ClockodoSignal, or `{ employeeId, clockodoUserId }`
   *      for an authoritative re-pull. Guarded by the Bearer / `?secret=` key.
   */
  .post("/webhooks/clockodo", async ({ body, headers, query, set }) => {
    const b = (body ?? {}) as Record<string, unknown>;

    // A. Validation handshake — surface the secret and acknowledge.
    if (typeof b.secret === "string" && !b.event_name && !b.employeeId) {
      console.log(`[clockodo] webhook validation secret: ${b.secret}`);
      return { ok: true };
    }

    // B. Native Clockodo event (entry.created / .updated / .stopped / .deleted).
    if (typeof b.event_name === "string") {
      const token = typeof b.token === "string" ? b.token : null;
      if (!clockodoTokenOk(token)) {
        set.status = 401;
        return { ok: false, error: "unauthorized" };
      }
      const payload = (b.payload ?? {}) as { entry?: { id?: number | string } };
      const entryId = payload.entry?.id;
      // Acknowledge events without an entry id so Clockodo doesn't retry them.
      if (entryId == null) return { ok: true, ignored: true };
      return await convex.action(api.clockodo.refreshClockodoByEntry, {
        secret: signalSecret(),
        entryId: String(entryId),
        eventName: b.event_name,
      });
    }

    // C. Legacy adapter shapes — keep the Bearer / ?secret= guard.
    const secret =
      bearer(headers) ?? (query.secret as string | undefined) ?? null;
    if (!checkKey(secret, process.env.ACTIVITYTRACK_WEBHOOK_SECRET)) {
      set.status = 401;
      return { ok: false, error: "unauthorized" };
    }

    const raw = b as { employeeId?: string; clockodoUserId?: string };
    if (raw.employeeId && raw.clockodoUserId) {
      return await convex.action(api.clockodo.refreshClockodo, {
        secret: signalSecret(),
        employeeId: raw.employeeId,
        clockodoUserId: raw.clockodoUserId,
      });
    }

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
