import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * ActivityTrack data model.
 *
 * Trust boundary: `activitySamples` is the raw, append-only firehose from
 * agents (lightly validated at ingest). Everything the dashboard shows is
 * derived from it — devices must be claimed/approved by an admin, and people
 * are linked to devices in the dashboard, not by the agent.
 *
 * Auth: Convex Auth (`@convex-dev/auth`) owns the `users`/`authAccounts`/...
 * tables via `authTables`. We extend the provided `users` table with a `role`
 * column so RBAC lives next to the identity it gates.
 */
export default defineSchema({
  // --- Convex Auth managed tables (users, authAccounts, authSessions, ...) ---
  ...authTables,

  // Override the auth-provided `users` table to add our dashboard role. The
  // base columns (name, email, image, ...) are still permitted; Convex Auth
  // writes them on sign-up. `role` defaults are assigned in auth.ts callbacks.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Dashboard role hierarchy: it_admin > manager > viewer.
    role: v.optional(
      v.union(v.literal("it_admin"), v.literal("manager"), v.literal("viewer")),
    ),
  }).index("email", ["email"]),

  // Physical machines. A device auto-registers as "pending" on first sample;
  // an admin approves it and (optionally) links it to a person.
  devices: defineTable({
    deviceId: v.string(), // the UUID minted by the agent (ProgramData)
    hostname: v.string(),
    lastWindowsUser: v.string(),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("disabled")),
    personId: v.optional(v.id("people")),
    lastSeen: v.number(),
    agentVersion: v.optional(v.string()),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_status", ["status"]),

  // Coworkers being tracked (managed in the dashboard; ~10, expandable).
  people: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    active: v.boolean(),
  }),

  // Raw samples (append-only). Indexed for time-range + per-device queries.
  activitySamples: defineTable({
    deviceId: v.string(),
    windowsUser: v.string(),
    hostname: v.string(),
    idleMs: v.number(),
    active: v.boolean(),
    capturedAt: v.number(),
    receivedAt: v.number(), // server clock, for skew detection
    tzOffsetMinutes: v.number(),
    agentVersion: v.string(),
    platform: v.string(),
  })
    .index("by_device_time", ["deviceId", "capturedAt"])
    .index("by_receivedAt", ["receivedAt"]),

  // Server-computed daily rollups (active vs idle seconds) for fast dashboards.
  dailyStats: defineTable({
    deviceId: v.string(),
    day: v.string(), // YYYY-MM-DD in the device's local tz
    activeSeconds: v.number(),
    idleSeconds: v.number(),
    firstSeen: v.number(),
    lastSeen: v.number(),
  })
    .index("by_device_day", ["deviceId", "day"])
    .index("by_day", ["day"]),

  // Append-only audit of privileged dashboard actions (IT/manager changes).
  auditLog: defineTable({
    actorUserId: v.id("users"),
    action: v.string(),
    target: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),

  // Singleton-ish key/value settings (e.g. hashed debug-tool password). Keyed
  // by `key`; written only by it_admin.
  settings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
