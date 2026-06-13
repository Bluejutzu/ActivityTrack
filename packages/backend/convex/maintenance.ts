import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Retention: prune raw `activitySamples` older than N days. Daily rollups in
 * `dailyStats` persist, so historical dashboards stay intact — we only drop the
 * raw firehose to keep the table bounded (PLAN default: 90 days).
 *
 * Deletes in bounded batches so a single mutation never runs unboundedly; the
 * cron re-runs daily and chips away until caught up.
 */
const DEFAULT_RETENTION_DAYS = 90;
const BATCH = 4_000;

export const pruneOldSamples = internalMutation({
  args: { retentionDays: v.optional(v.number()) },
  handler: async (ctx, { retentionDays }) => {
    const days = retentionDays ?? DEFAULT_RETENTION_DAYS;
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
