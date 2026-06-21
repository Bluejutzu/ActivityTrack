import { ApiTokens } from "convex-api-tokens";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { safeEqual } from "./crypto";
import { appError } from "./errors";

/**
 * Per-device API tokens for the desktop agent (convex-api-tokens component).
 *
 * The token is the agent's only credential — there is no shared bootstrap key
 * and no Clerk session on the device. It is minted exactly once when the device
 * is approved (see `devices.claimToken`), returned to the agent in that single
 * response, and never stored in plaintext: the component keeps only a SHA-256
 * hash. Disabling a device calls `apiTokens.invalidateAll({ namespace })`, after
 * which `validate` fails and the agent's ingest / heartbeat start returning 401.
 *
 * `namespace` is the agent's `deviceId`; `metadata` is unused for now.
 */
export const apiTokens = new ApiTokens<Record<string, never>>(
  components.apiTokens,
  { API_TOKENS_ENCRYPTION_KEY: process.env.API_TOKENS_ENCRYPTION_KEY },
);

/**
 * Validate a raw device token and confirm the owning device is still active.
 * Returns `{ deviceId }` on success, or `null` when the token is invalid,
 * expired, revoked, or the device is unknown/disabled. Plain helper (not a
 * Convex function) so both the `/ingest` httpAction and the Elysia-facing
 * `validate` mutation can share one implementation against a mutation ctx —
 * `apiTokens.validate` is a mutation (it touches the token's `lastUsedAt`).
 */
export async function validateDeviceToken(
  ctx: MutationCtx,
  token: string,
): Promise<{ deviceId: string } | null> {
  const res = await apiTokens.validate(ctx, { token });
  if (!res.ok) return null;
  const deviceId = res.namespace as string;
  const device = await ctx.db
    .query("devices")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
  if (!device || device.status === "disabled") return null;
  return { deviceId };
}

/**
 * Internal entry point for the device-keyed httpActions (/ingest, /agent/event,
 * /agent/verify-password): they can't touch the db directly, so they hop through
 * this mutation.
 */
export const validateInternal = internalMutation({
  args: { token: v.string() },
  handler: (ctx, { token }) => validateDeviceToken(ctx, token),
});

/**
 * Guard for the server-to-server mutations the Elysia API layer calls on the
 * device's behalf (token validation + the unauthenticated register/poll). The
 * device itself holds no secret — Elysia attaches `ACTIVITYTRACK_SIGNAL_SECRET`
 * — so these can't be spammed by arbitrary direct Convex callers. Mirrors
 * `state.pushSignal`'s trust model.
 */
export function assertSignalSecret(secret: string): void {
  const expected = process.env.ACTIVITYTRACK_SIGNAL_SECRET;
  if (!expected || !safeEqual(secret, expected)) {
    throw appError("auth.forbidden", "Invalid signal secret");
  }
}

/**
 * Public, secret-guarded validator for the Elysia API layer (heartbeat). Same
 * server-to-server trust model as `state.pushSignal`: the dashboard server holds
 * `ACTIVITYTRACK_SIGNAL_SECRET` and presents it; the device token rides in the
 * `token` arg. Never expose this to the browser.
 */
export const validate = mutation({
  args: { secret: v.string(), token: v.string() },
  handler: (ctx, { secret, token }) => {
    assertSignalSecret(secret);
    return validateDeviceToken(ctx, token);
  },
});
