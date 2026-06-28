import { v } from "convex/values";

import { query } from "../_generated/server";
import { safeEqual } from "./lib/crypto";
import { appError } from "./lib/errors";

/**
 * Secret-guarded, read-only paginated export of an ActivityTrack table.
 *
 * The migration action (running on the NEW advantis deployment) calls this on
 * THIS (the OLD ActivityTrack) deployment via a Convex HTTP client to stream
 * rows out batch-by-batch with a resumable cursor.
 *
 * Table-name note: the new deployment renamed the settings table to
 * `activitySettings`. This old deployment still calls it `settings`. We accept
 * the caller's `activitySettings` literal and read from the local `settings`
 * table so the new side does not need to know the old name. Every other
 * migrated table name is identical across both deployments.
 */
const EXPORTABLE = v.union(
  v.literal("people"),
  v.literal("devices"),
  v.literal("activitySamples"),
  v.literal("stateSamples"),
  v.literal("dailyStats"),
  v.literal("employeeStates"),
  v.literal("integrationHealth"),
  v.literal("settings"),
  v.literal("activitySettings")
);

function assertSecret(secret: string): void {
  const expected = process.env.ACTIVITYTRACK_SIGNAL_SECRET;
  if (!expected || !safeEqual(secret, expected)) {
    throw appError("auth.forbidden", "Invalid migration secret");
  }
}

export const exportTable = query({
  args: {
    secret: v.string(),
    table: EXPORTABLE,
    cursor: v.optional(v.union(v.string(), v.null())),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, { secret, table, cursor, numItems }) => {
    assertSecret(secret);
    // The new deployment's `activitySettings` lives here as `settings`.
    const dbTable = table === "activitySettings" ? "settings" : table;
    const result = await ctx.db.query(dbTable).paginate({
      cursor: cursor ?? null,
      numItems: Math.min(numItems ?? 200, 1000),
    });
    return {
      page: result.page,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
