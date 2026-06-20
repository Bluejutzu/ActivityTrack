import "server-only";
import { Elysia } from "elysia";
import { convex, api, signalSecret } from "./convex";
import { ingestAgentHeartbeat } from "./ingress/agent";
import { ingestGenesysNotify, ingestGenesysSync } from "./ingress/genesys";
import { ingestClockodoWebhook } from "./ingress/clockodo";
import type { IngressRequest, IngressResult } from "./ingress/shared";

/**
 * Dashboard-side write API (ElysiaJS, mounted into the Next.js App Router).
 *
 * This file is *only* routing. Each inbound data source — the agent heartbeat,
 * the Genesys relay, and the Clockodo webhook — flows through a uniform handler
 * in `./ingress/*` with the same `(IngressRequest) => Promise<IngressResult>`
 * shape, so there's one consistent pattern per source instead of one inline and
 * one in a folder. Auth + the secret-guarded push to Convex live in
 * `./ingress/shared`.
 *
 * Reactive *reads* stay on the Convex React client in the dashboard — this layer
 * never serves read models.
 */

type ElysiaSet = { status?: number | string };

/** Apply a handler's result to the Elysia response and return its body. */
function send(set: ElysiaSet, result: IngressResult): unknown {
  set.status = result.status;
  return result.body;
}

/** Build the transport-agnostic request slice the ingress handlers expect. */
function toIngressRequest(ctx: {
  body: unknown;
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
}): IngressRequest {
  return { body: ctx.body, headers: ctx.headers, query: ctx.query ?? {} };
}

export const app = new Elysia({ prefix: "/api" })
  .onError(async ({ error, set }) => {
    // Never leak internals; log server-side, return a terse message. Also surface
    // it on the dashboard's System Health page so integration/API failures aren't
    // buried in deploy logs. Best-effort: a logging failure (or a missing signal
    // secret) must never mask the original error.
    console.error("[api] error:", error);
    try {
      await convex.mutation(api.events.logFromServer, {
        secret: signalSecret(),
        severity: "error",
        code: "api.internal_error",
        message: error instanceof Error ? error.message : String(error),
      });
    } catch {
      /* swallow — logging is best-effort */
    }
    set.status = 500;
    return { ok: false, error: "internal_error" };
  })
  .get("/health", () => ({ ok: true }))
  .post("/activity/update", async ({ body, headers, set }) =>
    send(set, await ingestAgentHeartbeat(toIngressRequest({ body, headers }))),
  )
  .post("/integrations/genesys/notify", async ({ body, headers, set }) =>
    send(set, await ingestGenesysNotify(toIngressRequest({ body, headers }))),
  )
  .post("/integrations/genesys/sync", async ({ body, headers, set }) =>
    send(set, await ingestGenesysSync(toIngressRequest({ body, headers }))),
  )
  .post("/webhooks/clockodo", async ({ body, headers, query, set }) =>
    send(set, await ingestClockodoWebhook(toIngressRequest({ body, headers, query }))),
  );

export type App = typeof app;
