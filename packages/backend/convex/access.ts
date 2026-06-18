import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAdmin, requireViewer } from "./rbac";
import { writeAudit } from "./audit";

/**
 * Access control for the dashboard. This is a single-tenant internal tool:
 *   - A fixed set of admins is anchored in the ACTIVITYTRACK_ADMIN_EMAILS env
 *     var. They are always it_admin and can never be locked out of the
 *     deployment (they bypass the domain allowlist).
 *   - Everyone else may sign in only if their email domain is on the
 *     admin-editable allowlist (stored in `settings`, managed in the dashboard
 *     Settings → Access card — no redeploy needed).
 *
 * The rule is enforced server-side in `users.store`; this module owns the
 * helpers and the read/write surface the Settings UI uses.
 */

const ALLOWED_DOMAINS_KEY = "config.allowedDomains";

/** Strip a leading `@`, lowercase, trim — "  @Acme.COM " → "acme.com". */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, "");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email?: string): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  if (!email || at < 0) return null;
  return normalizeDomain(email.slice(at + 1));
}

/** Permanent admins, from the ACTIVITYTRACK_ADMIN_EMAILS env var (comma list). */
export function adminEmails(): string[] {
  const raw = process.env.ACTIVITYTRACK_ADMIN_EMAILS ?? "";
  return [
    ...new Set(
      raw
        .split(/[\n,]/)
        .map((e) => normalizeEmail(e))
        .filter(Boolean),
    ),
  ];
}

/** The admin-editable allowed email domains (stored as a JSON-array setting). */
export async function readAllowedDomains(
  ctx: QueryCtx | MutationCtx,
): Promise<string[]> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", ALLOWED_DOMAINS_KEY))
    .unique();
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((d): d is string => typeof d === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Decide whether an email may access the dashboard, and whether it's an admin.
 * Admins (env var) bypass the domain allowlist entirely, so editing domains can
 * never lock them out.
 */
export function isEmailAllowed(
  email: string | undefined,
  admins: string[],
  domains: string[],
): { allowed: boolean; isAdmin: boolean } {
  if (!email) return { allowed: false, isAdmin: false };
  const isAdmin = admins.includes(normalizeEmail(email));
  if (isAdmin) return { allowed: true, isAdmin: true };
  const domain = emailDomain(email);
  return { allowed: !!domain && domains.includes(domain), isAdmin: false };
}

/** Access-control state for the Settings UI: editable domains + read-only admins. */
export const getAccessControl = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    return {
      allowedDomains: await readAllowedDomains(ctx),
      adminEmails: adminEmails(),
    };
  },
});

/** Replace the allowed email domains. IT-only. */
export const setAllowedDomains = mutation({
  args: { domains: v.array(v.string()) },
  handler: async (ctx, { domains }) => {
    const actor = await requireAdmin(ctx);
    const normalized = [
      ...new Set(domains.map(normalizeDomain).filter(Boolean)),
    ];
    const now = Date.now();
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", ALLOWED_DOMAINS_KEY))
      .unique();
    const value = JSON.stringify(normalized);
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: now });
    } else {
      await ctx.db.insert("settings", {
        key: ALLOWED_DOMAINS_KEY,
        value,
        updatedAt: now,
      });
    }
    await writeAudit(
      ctx,
      actor._id,
      "access.setAllowedDomains",
      normalized.join(", "),
    );
    return normalized;
  },
});
