import "server-only";
import type { FunctionArgs } from "convex/server";
import { convex, api, signalSecret } from "../convex";

/**
 * Shared plumbing for the data-ingress handlers. Every inbound data source (the
 * desktop agent heartbeat, the Genesys relay, the Clockodo webhook) flows through
 * a handler with the SAME shape — `(IngressRequest) => Promise<IngressResult>` —
 * so `api.ts` is just routing and the per-source logic lives in one file each.
 * Auth, response shaping, and the secret-guarded push to Convex live here once,
 * instead of being copy-pasted per route.
 */

/** The transport-agnostic slice of a request a handler needs. */
export interface IngressRequest {
  body: unknown;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
}

/** What a handler returns; `api.ts` applies it to the Elysia response. */
export interface IngressResult {
  status: number;
  body: unknown;
}

export const ok = (body: Record<string, unknown> = {}): IngressResult => ({
  status: 200,
  body: { ok: true, ...body },
});

export const fail = (status: number, error: string): IngressResult => ({
  status,
  body: { ok: false, error },
});

/** Pass an action/mutation result straight through with a 200. */
export const passthrough = (body: unknown): IngressResult => ({
  status: 200,
  body,
});

/** Extract a Bearer token from request headers, if present. */
export function bearer(headers: IngressRequest["headers"]): string | null {
  const h = headers["authorization"];
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

/** True iff a non-empty `provided` equals a configured `expected`. */
export function keyMatches(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  return !!expected && !!provided && provided === expected;
}

type PushSignalArgs = Omit<FunctionArgs<typeof api.state.pushSignal>, "secret">;

/**
 * Push a normalized signal to the Convex fusion engine. The single place the
 * server-to-server secret is attached — handlers never touch it.
 */
export async function pushSignal(args: PushSignalArgs) {
  return await convex.mutation(api.state.pushSignal, {
    secret: signalSecret(),
    ...args,
  });
}
