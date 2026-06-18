import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { appError } from "./errors";
import { requireAdmin, requireUser } from "./rbac";
import { writeAudit } from "./audit";

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, "");
}

function emailDomain(email?: string): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  if (!email || at < 0) return null;
  return normalizeDomain(email.slice(at + 1));
}

export function clerkOrgIdFromIdentity(identity: {
  orgId?: unknown;
  organization_id?: unknown;
}): string | null {
  return typeof identity.orgId === "string"
    ? identity.orgId
    : typeof identity.organization_id === "string"
      ? identity.organization_id
      : null;
}

export async function orgByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkOrgId: string,
): Promise<Doc<"organizations"> | null> {
  return await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
    .unique();
}

export async function ensureOrganization(
  ctx: MutationCtx,
  args: { clerkOrgId: string; name?: string; email?: string },
): Promise<Id<"organizations">> {
  const existing = await orgByClerkId(ctx, args.clerkOrgId);
  if (existing) return existing._id;

  const domain = emailDomain(args.email);
  const now = Date.now();
  return await ctx.db.insert("organizations", {
    clerkOrgId: args.clerkOrgId,
    name: args.name,
    allowedDomains: domain ? [domain] : [],
    createdAt: now,
    updatedAt: now,
  });
}

export async function assertEmailAllowedForOrg(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  email?: string,
): Promise<void> {
  const org = await ctx.db.get(orgId);
  if (!org) throw appError("notFound.organization", "Organization not found");
  if (org.allowedDomains.length === 0) return;
  const domain = emailDomain(email);
  if (!domain || !org.allowedDomains.includes(domain)) {
    throw appError(
      "auth.domain_not_allowed",
      "Email domain is not allowed for this organization",
    );
  }
}

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user.orgId) return null;
    return await ctx.db.get(user.orgId);
  },
});

export const setAllowedDomains = mutation({
  args: { domains: v.array(v.string()) },
  handler: async (ctx, { domains }) => {
    const actor = await requireAdmin(ctx);
    if (!actor.orgId) {
      throw appError(
        "auth.organization_required",
        "Select an organization first",
      );
    }
    const normalized = [
      ...new Set(domains.map(normalizeDomain).filter(Boolean)),
    ];
    await ctx.db.patch(actor.orgId, {
      allowedDomains: normalized,
      updatedAt: Date.now(),
    });
    await writeAudit(
      ctx,
      actor._id,
      "organization.setAllowedDomains",
      normalized.join(", "),
    );
  },
});
