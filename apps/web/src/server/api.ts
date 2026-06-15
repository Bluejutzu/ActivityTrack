import "server-only";
import { Elysia } from "elysia";
import {
  activityUpdateSchema,
  clockodoSignalSchema,
  genesysSignalSchema,
} from "@activitytrack/shared";
import { convex, api, signalSecret, reportHealth } from "./convex";
import {
  fetchAbsences,
  fetchCurrentEntry,
  isAbsentOn,
  toSignal as toClockodoSignal,
} from "./integrations/clockodo";
import { fetchPresence, fetchRoutingStatus } from "./integrations/genesys";

/** Classify a thrown error so the dashboard distinguishes "off" from "broken". */
function healthStatusOf(err: unknown): "unavailable" | "unconfigured" {
  const msg = err instanceof Error ? err.message : String(err);
  return /not configured|not set/i.test(msg) ? "unconfigured" : "unavailable";
}
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Dashboard-side write API (ElysiaJS, mounted into the Next.js App Router).
 *
 * These are the *ingress* endpoints for the three signal sources. They
 * normalize/validate the inbound payload and push it into Convex
 * (`state.pushSignal`) via the secret-guarded server bridge. Reactive *reads*
 * stay on the Convex React client in the dashboard — this layer never serves
 * read models.
 *
 * Auth:
 *   - the agent heartbeat presents the bootstrap ingest key (same key the
 *     desktop tracker already uses);
 *   - the webhook/notify endpoints present the webhook secret.
 */

function bearer(headers: Record<string, string | undefined>): string | null {
  const h = headers["authorization"];
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

function checkKey(provided: string | null, expected: string | undefined) {
  return !!expected && provided === expected;
}

const day = (d = new Date()) => d.toISOString().slice(0, 10);

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
   * A WebSocket worker (or the realtime channel) posts a normalized event here;
   * we resolve the Genesys user id to an employeeId when needed and push.
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
   * POST /api/integrations/genesys/sync — polling fallback. Pulls routing
   * status + presence for one user from Genesys and pushes the result. Body:
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
    // Degrade gracefully: a Genesys outage records health and returns 200 so the
    // caller doesn't retry-storm; the last-known Genesys signal is left intact.
    try {
      const [routingStatus, presenceInfo] = await Promise.all([
        fetchRoutingStatus(b.genesysUserId),
        fetchPresence(b.genesysUserId),
      ]);
      const result = await convex.mutation(api.state.pushSignal, {
        secret: signalSecret(),
        employeeId: b.employeeId,
        source: "genesys",
        genesysRoutingStatus: routingStatus,
        genesysPresence: presenceInfo.presence,
        genesysWrapUp: presenceInfo.wrapUp,
      });
      await reportHealth("genesys", "ok");
      return { ok: true, finalState: result.finalState };
    } catch (err) {
      await reportHealth("genesys", healthStatusOf(err), errMessage(err));
      return { ok: false, error: "genesys_unavailable" };
    }
  })

  /**
   * POST /api/webhooks/clockodo — Clockodo time-tracking webhook
   * (entry.created/updated/stopped) or a pre-normalized push.
   *
   * Two shapes are accepted:
   *   1. A normalized ClockodoSignal ({ employeeId, working?, onBreak?, absent? })
   *      — when an adapter has already resolved the state.
   *   2. A raw event carrying { employeeId, clockodoUserId } — we re-pull the
   *      current entry + absences and recompute the Clockodo slice ourselves.
   */
  .post("/webhooks/clockodo", async ({ body, headers, query, set }) => {
    const secret = bearer(headers) ?? (query.secret as string | undefined) ?? null;
    if (!checkKey(secret, process.env.ACTIVITYTRACK_WEBHOOK_SECRET)) {
      set.status = 401;
      return { ok: false, error: "unauthorized" };
    }

    const raw = body as { employeeId?: string; clockodoUserId?: string };

    // Mode 2: re-pull from Clockodo for an authoritative snapshot.
    if (raw?.employeeId && raw?.clockodoUserId) {
      try {
        const today = day();
        const [running, absences] = await Promise.all([
          fetchCurrentEntry(),
          fetchAbsences(new Date().getFullYear()),
        ]);
        const signal = toClockodoSignal(
          raw.employeeId,
          raw.clockodoUserId,
          running,
          absences,
          today,
        );
        const result = await convex.mutation(api.state.pushSignal, {
          secret: signalSecret(),
          employeeId: signal.employeeId,
          source: "clockodo",
          clockodoWorking: signal.working,
          clockodoBreak: signal.onBreak,
          clockodoAbsent: signal.absent,
        });
        await reportHealth("clockodo", "ok");
        return { ok: true, finalState: result.finalState };
      } catch (err) {
        await reportHealth("clockodo", healthStatusOf(err), errMessage(err));
        return { ok: false, error: "clockodo_unavailable" };
      }
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
  })

  /**
   * GET|POST /api/integrations/poll — the no-extra-host fallback.
   *
   * Polls Genesys (routing status + presence per mapped user) and Clockodo
   * (org-wide approved absences) and pushes the results into Convex. Designed to
   * be triggered by Vercel Cron — which sends `Authorization: Bearer
   * $CRON_SECRET` — so realtime works without self-hosting the Genesys worker.
   * Each source is isolated: one failing only records that source's health and
   * leaves its last-known signals (and the other source) untouched.
   */
  .all("/integrations/poll", async ({ headers, query, set }) => {
    const token =
      bearer(headers) ?? (query.secret as string | undefined) ?? null;
    const authorized =
      checkKey(token, process.env.CRON_SECRET) ||
      checkKey(token, process.env.ACTIVITYTRACK_WEBHOOK_SECRET);
    if (!authorized) {
      set.status = 401;
      return { ok: false, error: "unauthorized" };
    }
    return await runPoll();
  });

/** Poll all configured sources for all mapped people. Never throws. */
async function runPoll(): Promise<Record<string, unknown>> {
  const secret = signalSecret();
  const mappings = await convex.query(api.state.mappings, { secret });
  const out: Record<string, unknown> = {};

  // --- Genesys: per-user routing status + presence ---
  const genesysPeople = mappings.filter((p) => p.genesysUserId);
  if (genesysPeople.length > 0) {
    try {
      let polled = 0;
      for (const p of genesysPeople) {
        const [routingStatus, presenceInfo] = await Promise.all([
          fetchRoutingStatus(p.genesysUserId!),
          fetchPresence(p.genesysUserId!),
        ]);
        await convex.mutation(api.state.pushSignal, {
          secret,
          employeeId: p.employeeId,
          source: "genesys",
          genesysRoutingStatus: routingStatus,
          genesysPresence: presenceInfo.presence,
          genesysWrapUp: presenceInfo.wrapUp,
        });
        polled++;
      }
      await reportHealth("genesys", "ok");
      out.genesys = { polled };
    } catch (err) {
      await reportHealth("genesys", healthStatusOf(err), errMessage(err));
      out.genesys = { error: errMessage(err) };
    }
  }

  // --- Clockodo: org-wide approved absences (the override the agent can't see).
  // Working/break stay webhook-driven (Clockodo's running-entry endpoint is
  // scoped to the API user, so it can't be polled per employee reliably).
  const clockodoPeople = mappings.filter((p) => p.clockodoUserId);
  if (clockodoPeople.length > 0) {
    try {
      const today = day();
      const absences = await fetchAbsences(new Date().getFullYear());
      for (const p of clockodoPeople) {
        await convex.mutation(api.state.pushSignal, {
          secret,
          employeeId: p.employeeId,
          source: "clockodo",
          clockodoAbsent: isAbsentOn(absences, p.clockodoUserId!, today),
        });
      }
      await reportHealth("clockodo", "ok");
      out.clockodo = { polled: clockodoPeople.length };
    } catch (err) {
      await reportHealth("clockodo", healthStatusOf(err), errMessage(err));
      out.clockodo = { error: errMessage(err) };
    }
  }

  return { ok: true, ...out };
}

export type App = typeof app;
