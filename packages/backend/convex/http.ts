import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  ingestPayloadSchema,
  type ActivitySample,
} from "@activitytrack/shared";
import { z } from "zod";
import { verifyPassword } from "./crypto";
import { DEBUG_PASSWORD_SETTING_KEY } from "./settings";
import {
  bearerToken,
  unauthorized,
  badRequest,
  jsonResponse,
  readJson,
} from "./httpHelpers";

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
 * Authenticate a request by its per-device token (issued at approval, owned by
 * the convex-api-tokens component). Returns the device, or null when the header
 * is absent or the token is invalid / expired / revoked / belongs to a disabled
 * device. Shared by the device-keyed endpoints (/ingest, /agent/event,
 * /agent/verify-password).
 */
async function authenticateDevice(
  ctx: ActionCtx,
  request: Request,
): Promise<{ deviceId: string } | null> {
  const token = bearerToken(request);
  if (!token) return null;
  return await ctx.runMutation(internal.deviceAuth.validateInternal, { token });
}

/**
 * POST /ingest — authenticated by per-device key (issued at enrollment).
 * Only samples matching the authenticated deviceId are accepted.
 */
http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // NOTE: we deliberately do NOT log unauthenticated ingest rejections. This
    // is a public endpoint, so logging a DB write per rejected request turns
    // anonymous spam into write amplification — and unknown-key hits are mostly
    // internet-scanner noise, not actionable signal. We only log failures from
    // an *authenticated* device (below), where the deviceId is known.
    const deviceAuth = await authenticateDevice(ctx, request);
    if (!deviceAuth) return unauthorized();

    const body = await readJson(request);
    if (body === undefined) {
      await logBackendEvent(ctx, {
        severity: "warning",
        code: "ingest.bad_payload",
        message: "Ingest rejected: request body was not valid JSON.",
        deviceId: deviceAuth.deviceId,
      });
      return badRequest();
    }

    const parsed = ingestPayloadSchema.safeParse(body);
    if (!parsed.success) {
      await logBackendEvent(ctx, {
        severity: "warning",
        code: "ingest.bad_payload",
        message: "Ingest rejected: payload failed schema validation.",
        deviceId: deviceAuth.deviceId,
        context: JSON.stringify(parsed.error.issues.slice(0, 5)),
      });
      return badRequest();
    }

    const now = Date.now();
    const accepted = parsed.data.samples.filter((s: ActivitySample) => {
      if (s.deviceId !== deviceAuth.deviceId) return false;
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
      // Per-device rate limit tripped and nothing was stored: tell the agent to
      // back off. It keeps the batch and retries on the next flush, so no
      // legitimate data is lost — only a flood is shed.
      if (result.throttled && inserted === 0) {
        return new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "30" },
        });
      }
    }

    return jsonResponse(200, {
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

// NOTE: device enrollment (register) and approval polling (claim) moved to the
// Elysia API layer — POST /api/agent/register and /api/agent/poll — which call
// `devices.requestEnrollment` / `devices.claimToken`. The agent's only Convex
// httpActions are the device-token-authenticated ones below.

const agentEventSchema = z.object({
  severity: z.enum(["info", "warning", "error", "critical"]),
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(2000),
  hostname: z.string().max(255).optional(),
});

/**
 * POST /agent/event — the tracker reports its own operational problems
 * (repeated send failures, local IO errors). Authenticated by the device key so
 * events are attributed to a real enrolled device.
 */
http.route({
  path: "/agent/event",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const deviceAuth = await authenticateDevice(ctx, request);
    if (!deviceAuth) return unauthorized();

    const body = await readJson(request);
    if (body === undefined) return badRequest();
    const parsed = agentEventSchema.safeParse(body);
    if (!parsed.success) return badRequest();

    await ctx.runMutation(internal.events.record, {
      source: "tracker",
      severity: parsed.data.severity,
      code: parsed.data.code,
      message: parsed.data.message,
      deviceId: deviceAuth.deviceId,
      hostname: parsed.data.hostname,
    });

    return jsonResponse(200, { ok: true });
  }),
});

/**
 * POST /agent/verify-password — tray-app debug login.
 * Authenticated by the device token (the device must be paired). Verifies the
 * candidate against the hash IT set in the dashboard; the hash never leaves the
 * server.
 */
http.route({
  path: "/agent/verify-password",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if ((await authenticateDevice(ctx, request)) === null) return unauthorized();

    const body = (await readJson(request)) as { password?: unknown } | undefined;
    if (!body || typeof body.password !== "string") return badRequest();

    const row = await ctx.runQuery(internal.settings.getByKey, {
      key: DEBUG_PASSWORD_SETTING_KEY,
    });
    if (!row) return jsonResponse(503, { ok: false, reason: "unset" });

    const passwordOk = await verifyPassword(body.password, row.value);
    return jsonResponse(passwordOk ? 200 : 401, { ok: passwordOk });
  }),
});

export default http;
