import { query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./rbac";

/**
 * Append an entry to the privileged-action audit log. Called from every admin
 * mutation that mutates devices/people/users/settings so IT can review who did
 * what. Append-only — never updated or deleted by app code.
 */
export async function writeAudit(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  action: string,
  target?: string,
): Promise<void> {
  await ctx.db.insert("auditLog", {
    actorUserId,
    action,
    target,
    at: Date.now(),
  });
}

/** Audit log, newest first. IT-only. */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_at")
      .order("desc")
      .take(Math.min(limit ?? 100, 500));

    // Hydrate actor names for display — batch-load distinct actors once.
    const actorIds = [...new Set(rows.map((r) => r.actorUserId))];
    const actorsById = new Map(
      (await Promise.all(actorIds.map((id) => ctx.db.get(id)))).flatMap((u) =>
        u ? [[u._id, u] as const] : [],
      ),
    );

    return rows.map((row) => {
      const actor = actorsById.get(row.actorUserId);
      return {
        ...row,
        actorName: actor?.name ?? actor?.email ?? "unknown",
      };
    });
  },
});
