import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { ingestPayloadSchema, type ActivitySample } from "@activitytrack/shared";
import { z } from "zod";
import { auth } from "./auth";
import { verifyPassword, generateDeviceKey, hashDeviceKey } from "./crypto";
import { DEBUG_PASSWORD_SETTING_KEY } from "./settings";

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_PAST_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const http = httpRouter();

/**
 * Log an operational event from an HTTP action. HTTP actions can't touch the db
 * directly, so we hop through the internal `events.record` mutation. Best-effort
 * — a logging failure must never break the request being handled.
 */
async function logBackendEvent(
  ctx: ActionCtx,
  event: {
    severity: "info" | "warning" | "error" | "critical";
    code: string;
    message: string;
    deviceId?: string;
    hostname?: string;
    context?: string;
  },
): Promise<void> {
  try {
    await ctx.runMutation(internal.events.record, {
      source: "backend",
      ...event,
    });
  } catch {
    // Swallowing here is intentional and the ONLY place we do: the event log is
    // a diagnostic side-channel and must not take down ingest/enrollment.
  }
}

/**
 * POST /ingest — authenticated by per-device key (issued at enrollment).
 * The device key is hashed and looked up in the deviceKeys table. Only
 * samples matching the authenticated deviceId are accepted.
 */
http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      await logBackendEvent(ctx, {
        severity: "warning",
        code: "ingest.unauthorized",
        message: "Ingest rejected: missing or malformed Authorization header.",
      });
      return new Response("unauthorized", { status: 401 });
    }
    const rawKey = authHeader.slice(7);
    const keyHash = await hashDeviceKey(rawKey);
    const deviceId = await ctx.runQuery(
      internal.devices.lookupDeviceByKeyHash,
      { keyHash },
    );
    if (!deviceId) {
      await logBackendEvent(ctx, {
        severity: "warning",
        code: "ingest.unauthorized",
        message:
          "Ingest rejected: device key did not match any enrolled device (unknown, revoked, or disabled).",
      });
      return new Response("unauthorized", { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      await logBackendEvent(ctx, {
        severity: "warning",
        code: "ingest.bad_payload",
        message: "Ingest rejected: request body was not valid JSON.",
        deviceId,
      });
      return new Response("bad request", { status: 400 });
    }

    const parsed = ingestPayloadSchema.safeParse(body);
    if (!parsed.success) {
      await logBackendEvent(ctx, {
        severity: "warning",
        code: "ingest.bad_payload",
        message: "Ingest rejected: payload failed schema validation.",
        deviceId,
        context: JSON.stringify(parsed.error.issues.slice(0, 5)),
      });
      return new Response("bad request", { status: 400 });
    }

    const now = Date.now();
    const accepted = parsed.data.samples.filter((s: ActivitySample) => {
      if (s.deviceId !== deviceId) return false;
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

const registerSchema = z.object({
  enrollmentCode: z.string().min(1).max(20),
  deviceId: z.string().min(1).max(128),
  hostname: z.string().min(1).max(255),
  windowsUser: z.string().min(1).max(255),
  agentVersion: z.string().min(1).max(50),
});

/**
 * POST /agent/register — one-time device enrollment.
 * Authenticated by the shared bootstrap key. Validates the one-time
 * enrollment code, issues a device-specific key, and registers the device.
 */
http.route({
  path: "/agent/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.ACTIVITYTRACK_INGEST_KEY;
    const authHeader = request.headers.get("authorization");
    if (!expected || authHeader !== `Bearer ${expected}`) {
      await logBackendEvent(ctx, {
        severity: "warning",
        code: "enroll.unauthorized",
        message:
          "Enrollment rejected: bootstrap key missing or incorrect (a build with the wrong/absent ACTIVITYTRACK_INGEST_KEY tried to register).",
      });
      return new Response("unauthorized", { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return new Response("bad request", { status: 400 });
    }

    const { enrollmentCode, deviceId, hostname, windowsUser, agentVersion } =
      parsed.data;

    const validation = await ctx.runQuery(
      internal.devices.validateEnrollmentCode,
      { code: enrollmentCode },
    );
    if (!validation.valid) {
      const reasons: Record<string, string> = {
        not_found: "enrollment code not found",
        used: "enrollment code already used",
        expired: "enrollment code has expired",
      };
      await logBackendEvent(ctx, {
        severity: "warning",
        code: "enroll.code_invalid",
        message: `Enrollment rejected for "${hostname}": ${reasons[validation.reason] ?? "invalid code"}.`,
        deviceId,
        hostname,
        context: `code=${enrollmentCode} reason=${validation.reason}`,
      });
      return new Response(reasons[validation.reason] ?? "invalid code", {
        status: 404,
      });
    }

    const rawKey = generateDeviceKey();
    const keyHash = await hashDeviceKey(rawKey);

    await ctx.runMutation(internal.devices.completeRegistration, {
      slotId: validation.slotId,
      deviceId,
      hostname,
      windowsUser,
      agentVersion,
      keyHash,
    });

    return Response.json({ deviceKey: rawKey });
  }),
});

const agentEventSchema = z.object({
  severity: z.enum(["info", "warning", "error", "critical"]),
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(2000),
  hostname: z.string().max(255).optional(),
});

/**
 * POST /agent/event — the tracker reports its own operational problems
 * (repeated send failures, local IO errors). Authenticated by the device key
 * so events are attributed to a real enrolled device. The tracker is expected
 * to rate-limit itself; dedup on the server bounds the rest.
 */
http.route({
  path: "/agent/event",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("unauthorized", { status: 401 });
    }
    const keyHash = await hashDeviceKey(authHeader.slice(7));
    const deviceId = await ctx.runQuery(
      internal.devices.lookupDeviceByKeyHash,
      { keyHash },
    );
    if (!deviceId) {
      return new Response("unauthorized", { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }
    const parsed = agentEventSchema.safeParse(body);
    if (!parsed.success) {
      return new Response("bad request", { status: 400 });
    }

    await ctx.runMutation(internal.events.record, {
      source: "tracker",
      severity: parsed.data.severity,
      code: parsed.data.code,
      message: parsed.data.message,
      deviceId,
      hostname: parsed.data.hostname,
    });

    return Response.json({ ok: true });
  }),
});

/**
 * POST /agent/verify-password — tray-app debug login.
 * Authenticated by either the device-specific key or the bootstrap key
 * (to support local dev before enrollment). Verifies the candidate against
 * the hash IT set in the dashboard; the hash never leaves the server.
 */
http.route({
  path: "/agent/verify-password",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("unauthorized", { status: 401 });
    }
    const rawKey = authHeader.slice(7);

    // Accept device key or bootstrap key (bootstrap allows local dev before enrollment)
    const bootstrapKey = process.env.ACTIVITYTRACK_INGEST_KEY;
    let authorized = false;
    if (bootstrapKey && rawKey === bootstrapKey) {
      authorized = true;
    } else {
      const keyHash = await hashDeviceKey(rawKey);
      const deviceId = await ctx.runQuery(
        internal.devices.lookupDeviceByKeyHash,
        { keyHash },
      );
      authorized = deviceId !== null;
    }
    if (!authorized) {
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

auth.addHttpRoutes(http);

export default http;
