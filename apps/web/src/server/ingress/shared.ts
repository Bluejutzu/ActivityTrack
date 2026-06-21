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

/**
 * Validate a desktop agent's device token (issued at approval, owned by the
 * convex-api-tokens component). Returns `{ deviceId }` when the token is good and
 * its device is active, else `null`. The signal secret authenticates *this*
 * server to Convex; the device token rides in `token`.
 */
export async function validateDeviceToken(
  token: string,
): Promise<{ deviceId: string } | null> {
  return await convex.mutation(api.deviceAuth.validate, {
    secret: signalSecret(),
    token,
  });
}

type RequestEnrollmentArgs = Omit<
  FunctionArgs<typeof api.devices.requestEnrollment>,
  "secret"
>;

/** Self-registration relay: the device posts here (no auth); we add the secret. */
export async function requestEnrollment(args: RequestEnrollmentArgs) {
  return await convex.mutation(api.devices.requestEnrollment, {
    secret: signalSecret(),
    ...args,
  });
}

type ClaimTokenArgs = Omit<
  FunctionArgs<typeof api.devices.claimToken>,
  "secret"
>;

/** Approval-poll relay: returns the freshly minted token once approved. */
export async function claimDeviceToken(args: ClaimTokenArgs) {
  return await convex.mutation(api.devices.claimToken, {
    secret: signalSecret(),
    ...args,
  });
}
