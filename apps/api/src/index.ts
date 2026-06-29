import { Elysia } from "elysia";
import { convex, api, signalSecret } from "./convex";
import { registerAgent, pollAgent, ingestAgentHeartbeat } from "./ingress/agent";
import { ingestGenesysNotify, ingestGenesysSync } from "./ingress/genesys";
import { ingestClockodoWebhook } from "./ingress/clockodo";
import type { IngressRequest, IngressResult } from "./ingress/shared";

/**
 * Standalone ingress API for api.advantisgroup.de.
 *
 * This is a direct port of apps/web/src/server/api.ts, but running as an
 * independent Bun process instead of an embedded Next.js sub-app. Routes mount
 * at root level (no /api prefix). Handler logic is unchanged — all ingress
 * business logic lives in ./ingress/*.
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

const app = new Elysia()
  .onError(async ({ error, set }) => {
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
  .post("/agent/register", async ({ body, headers, set }) =>
    send(set, await registerAgent(toIngressRequest({ body, headers }))),
  )
  .post("/agent/poll", async ({ body, headers, set }) =>
    send(set, await pollAgent(toIngressRequest({ body, headers }))),
  )
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

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[api] listening on port ${port}`);
});

export type App = typeof app;
