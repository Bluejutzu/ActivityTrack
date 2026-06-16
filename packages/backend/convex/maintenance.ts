import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { readConfig } from "./settings";

/**
 * Retention: prune raw `activitySamples` and `stateSamples` older than N days.
 * Daily rollups in `dailyStats` persist, so historical dashboards stay intact —
 * we only drop the raw firehoses to keep those tables bounded. The window comes
 * from the operational config (Settings → Configuration; default 90 days).
 *
 * Deletes in bounded batches so a single mutation never runs unboundedly; the
 * cron re-runs daily and chips away until caught up.
 */
const BATCH = 4_000;

export const pruneOldSamples = internalMutation({
  args: { retentionDays: v.optional(v.number()) },
  handler: async (ctx, { retentionDays }) => {
    const days = retentionDays ?? (await readConfig(ctx)).retentionDays;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const stale = await ctx.db
      .query("activitySamples")
      .withIndex("by_receivedAt", (q) => q.lt("receivedAt", cutoff))
      .take(BATCH);

    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    return { deleted: stale.length };
  },
});

/** Retention: drop fused-state history older than the configured window. */
export const pruneOldStateSamples = internalMutation({
  args: { retentionDays: v.optional(v.number()) },
  handler: async (ctx, { retentionDays }) => {
    const days = retentionDays ?? (await readConfig(ctx)).retentionDays;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const stale = await ctx.db
      .query("stateSamples")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(BATCH);

    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    return { deleted: stale.length };
  },
});
