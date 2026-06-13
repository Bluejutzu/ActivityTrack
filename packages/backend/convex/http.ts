import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { ingestPayloadSchema, type ActivitySample } from "@activitytrack/shared";
import { auth } from "./auth";
import { verifyPassword } from "./crypto";
import { DEBUG_PASSWORD_SETTING_KEY } from "./settings";

/**
 * The agent's only entry point. This is where ALL validation lives — the
 * desktop app is a dumb sender by design.
 *
 * Checks performed here:
 *   1. Bearer token == ACTIVITYTRACK_INGEST_KEY env var (reject otherwise).
 *   2. zod schema validation via ingestPayloadSchema (reject malformed).
 *   3. Clock-skew sanity: drop samples whose capturedAt is implausibly far
 *      from server now() (future skew or ancient backlog).
 *   4. Hand the survivors to the internal recordSamples mutation, which
 *      auto-registers devices, ignores disabled ones, and rolls up daily stats.
 */

// Reject samples claiming to be from more than this far in the future (clock
// ahead) or older than this in the past (stale/replayed backlog).
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PAST_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const http = httpRouter();

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.ACTIVITYTRACK_INGEST_KEY;
    const authHeader = request.headers.get("authorization");
    if (!expected || authHeader !== `Bearer ${expected}`) {
      return new Response("unauthorized", { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }

    const parsed = ingestPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response("bad request", { status: 400 });
    }

    // Clock-skew filter. We keep the request 200 even if everything is dropped
    // — the agent shouldn't retry forever on its own bad clock.
    const now = Date.now();
    const accepted = parsed.data.samples.filter((s: ActivitySample) => {
      const ahead = s.capturedAt - now;
      if (ahead > MAX_FUTURE_SKEW_MS) return false;
      if (now - s.capturedAt > MAX_PAST_AGE_MS) return false;
      return true;
    });

    let inserted = 0;
    if (accepted.length > 0) {
      const result = await ctx.runMutation(internal.ingest.recordSamples, {
        samples: accepted,
      });
      inserted = result.inserted;
    }

    return Response.json({
      ok: true,
      received: parsed.data.samples.length,
      inserted,
      dropped: parsed.data.samples.length - accepted.length,
    });
  }),
});

/**
 * Tray-app debug login. The agent posts a candidate password (authenticated by
 * the same shared ingest key); we verify it against the hash IT set in the
 * dashboard. The hash never leaves the server. Returns 200 on match, 401 if
 * wrong, 503 if no password has been configured yet.
 */
http.route({
  path: "/agent/verify-password",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.ACTIVITYTRACK_INGEST_KEY;
    const authHeader = request.headers.get("authorization");
    if (!expected || authHeader !== `Bearer ${expected}`) {
      return new Response("unauthorized", { status: 401 });
    }

    let body: { password?: unknown };
    try {
      body = (await request.json()) as { password?: unknown };
    } catch {
      return new Response("bad request", { status: 400 });
    }
    if (typeof body.password !== "string") {
      return new Response("bad request", { status: 400 });
    }

    const row = await ctx.runQuery(internal.settings.getByKey, {
      key: DEBUG_PASSWORD_SETTING_KEY,
    });
    if (!row) {
      return new Response(JSON.stringify({ ok: false, reason: "unset" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    const ok = await verifyPassword(body.password, row.value);
    return new Response(JSON.stringify({ ok }), {
      status: ok ? 200 : 401,
      headers: { "content-type": "application/json" },
    });
  }),
});

// Convex Auth HTTP routes (sign-in/up, token refresh, etc.).
auth.addHttpRoutes(http);

export default http;
