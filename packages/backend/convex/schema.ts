import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ActivityTrack data model.
 *
 * Trust boundary: `activitySamples` is the raw, append-only firehose from
 * agents (lightly validated at ingest). Everything the dashboard shows is
 * derived from it — devices must be claimed/approved by an admin, and people
 * are linked to devices in the dashboard, not by the agent.
 *
 * Auth: Clerk owns identity; Convex verifies the Clerk JWT (see auth.config.ts).
 * We keep a local `users` row per Clerk account — keyed by the Clerk `subject`
 * (the JWT `sub` claim) — so RBAC and `v.id("users")` references live next to
 * the identity they gate. Rows are upserted by `users.store` on first sign-in.
 */
export default defineSchema({
  // One row per Clerk account. `subject` is the Clerk user id (JWT `sub`); it's
  // the join key between the Clerk session and our RBAC. `role` defaults are
  // assigned in `users.store` (first user → it_admin, everyone else → viewer).
  users: defineTable({
    subject: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    // Dashboard role hierarchy: it_admin > manager > viewer.
    role: v.optional(
      v.union(v.literal("it_admin"), v.literal("manager"), v.literal("viewer")),
    ),
  })
    .index("by_subject", ["subject"])
    .index("email", ["email"]),

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
    .index("by_status", ["status"])
    .index("by_personId", ["personId"]),

  // Coworkers being tracked (managed in the dashboard; ~10, expandable).
  //
  // The external-id fields map a person to their identity in the integrated
  // systems. `employeeId` is the stable key used across all three signal
  // sources (agent / Genesys / Clockodo) and the `employeeStates` cache;
  // `genesysUserId`/`clockodoUserId` let the backend resolve an inbound signal
  // (which carries a source-native user id) back to the canonical employeeId.
  people: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    active: v.boolean(),
    employeeId: v.optional(v.string()),
    genesysUserId: v.optional(v.string()),
    clockodoUserId: v.optional(v.string()),
  })
    .index("by_employeeId", ["employeeId"])
    .index("by_genesysUserId", ["genesysUserId"])
    .index("by_clockodoUserId", ["clockodoUserId"]),

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

  // Fused employee-state cache: the single source of truth combining the
  // desktop agent, Genesys telephony, and Clockodo time-tracking into one
  // normalized state. One row per `employeeId`. Each source patches its own
  // slice of signals; `finalState` is recomputed by the state engine on every
  // write. Per-source `*UpdatedAt` timestamps support staleness detection.
  employeeStates: defineTable({
    employeeId: v.string(),

    // Workstation (desktop agent).
    deviceIdle: v.optional(v.boolean()),
    idleSeconds: v.optional(v.number()),
    agentUpdatedAt: v.optional(v.number()),

    // Genesys telephony.
    genesysRoutingStatus: v.optional(
      v.union(
        v.literal("IDLE"),
        v.literal("INTERACTING"),
        v.literal("OFF_QUEUE"),
        v.literal("NOT_RESPONDING"),
      ),
    ),
    genesysPresence: v.optional(
      v.union(
        v.literal("AVAILABLE"),
        v.literal("BUSY"),
        v.literal("AWAY"),
        v.literal("OFFLINE"),
      ),
    ),
    genesysWrapUp: v.optional(v.boolean()),
    genesysUpdatedAt: v.optional(v.number()),

    // Clockodo time-tracking.
    clockodoWorking: v.optional(v.boolean()),
    clockodoBreak: v.optional(v.boolean()),
    clockodoAbsent: v.optional(v.boolean()),
    clockodoUpdatedAt: v.optional(v.number()),

    // Engine output.
    finalState: v.union(
      v.literal("ABSENT"),
      v.literal("BREAK"),
      v.literal("IN_CALL"),
      v.literal("WRAP_UP"),
      v.literal("ACTIVE"),
      v.literal("IDLE"),
    ),
    updatedAt: v.number(),
  }).index("by_employeeId", ["employeeId"]),

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

  // Operational error/health events from every surface (backend, tracker,
  // dashboard). Deduplicated: a recurring failure bumps `count`/`lastAt` on a
  // single open row instead of spawning thousands. `message`/`context` carry
  // the technical detail for IT; the dashboard renders a plain-language
  // version from `code` for non-technical viewers. Never store secrets here.
  systemEvents: defineTable({
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("critical"),
    ),
    code: v.string(), // machine code, e.g. "ingest.unauthorized"
    source: v.union(
      v.literal("backend"),
      v.literal("tracker"),
      v.literal("dashboard"),
    ),
    message: v.string(), // technical detail (for IT)
    deviceId: v.optional(v.string()),
    hostname: v.optional(v.string()),
    context: v.optional(v.string()), // extra technical context (freeform/JSON)
    count: v.number(), // how many times this collapsed event has occurred
    firstAt: v.number(),
    lastAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
  })
    .index("by_lastAt", ["lastAt"])
    // Open (unresolved) rows for a code+device — used for dedup lookups.
    .index("by_open", ["resolvedAt", "code", "deviceId"])
    .index("by_resolvedAt", ["resolvedAt", "lastAt"]),

  // Singleton-ish key/value settings (e.g. hashed debug-tool password). Keyed
  // by `key`; written only by it_admin.
  settings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  deviceSlots: defineTable({
    code: v.string(),
    label: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    usedByDeviceId: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_createdAt", ["createdAt"]),

  deviceKeys: defineTable({
    deviceId: v.string(),
    keyHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_deviceId", ["deviceId"]),
});
