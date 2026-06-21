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
  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.optional(v.string()),
    allowedDomains: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerkOrgId", ["clerkOrgId"]),

  users: defineTable({
    subject: v.string(),
    orgId: v.optional(v.id("organizations")),
    clerkOrgId: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    // Dashboard role hierarchy: it_admin > manager > viewer.
    role: v.optional(
      v.union(v.literal("it_admin"), v.literal("manager"), v.literal("viewer")),
    ),
  })
    .index("by_subject", ["subject"])
    .index("email", ["email"])
    .index("by_org", ["orgId"]),

  // Physical machines. A device self-registers as "pending" on first run; an
  // admin approves it (status → "active"), which lets it claim its one device
  // token (see deviceAuth.ts / devices.claimToken) and start ingesting.
  devices: defineTable({
    orgId: v.optional(v.id("organizations")),
    deviceId: v.string(), // the UUID minted by the agent (ProgramData)
    hostname: v.string(),
    lastWindowsUser: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("disabled"),
    ),
    personId: v.optional(v.id("people")),
    lastSeen: v.number(),
    agentVersion: v.optional(v.string()),
    // SHA-256 of the agent's one-time pairing nonce, set on register and checked
    // on claim so only the registering machine can claim this device's token.
    claimNonceHash: v.optional(v.string()),
    // True once the device has claimed its token after approval. Reset by
    // `approve` so a re-approved (previously disabled) device re-claims a fresh
    // token; gates `claimToken` so the once-only raw token isn't re-requested.
    tokenIssued: v.optional(v.boolean()),
    // Wall-clock time (receivedAt) of the last ACCEPTED ingest batch. Used to
    // throttle a flood from a leaked device token; optional for pre-existing rows.
    lastIngestAt: v.optional(v.number()),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_org_deviceId", ["orgId", "deviceId"])
    .index("by_org_status", ["orgId", "status"])
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
    orgId: v.optional(v.id("organizations")),
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
    orgId: v.optional(v.id("organizations")),
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
    orgId: v.optional(v.id("organizations")),
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

  // Append-only history of an employee's fused state, written on every change
  // by `state.pushSignal`. Powers the per-hour state breakdown on the device
  // timeline (idle / in-call / break / wrap-up by hour of day). Insert-on-change
  // keeps this bounded; pruned on the same retention window as raw samples.
  stateSamples: defineTable({
    orgId: v.optional(v.id("organizations")),
    employeeId: v.string(),
    state: v.union(
      v.literal("ABSENT"),
      v.literal("BREAK"),
      v.literal("IN_CALL"),
      v.literal("WRAP_UP"),
      v.literal("ACTIVE"),
      v.literal("IDLE"),
    ),
    at: v.number(),
  })
    .index("by_employee_time", ["employeeId", "at"])
    .index("by_at", ["at"]),

  // Integration health, one row per external source. Lets the dashboard show
  // "Genesys unavailable due to <reason>" without the failure ever breaking the
  // state pipeline — a down source simply stops contributing fresh signals.
  integrationHealth: defineTable({
    orgId: v.optional(v.id("organizations")),
    source: v.union(v.literal("genesys"), v.literal("clockodo")),
    status: v.union(
      v.literal("ok"),
      v.literal("unavailable"),
      v.literal("unconfigured"),
    ),
    message: v.optional(v.string()), // the "xyz" reason, when not ok
    lastOkAt: v.optional(v.number()),
    lastErrorAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_source", ["source"]),

  // Server-computed daily rollups (active vs idle seconds) for fast dashboards.
  dailyStats: defineTable({
    orgId: v.optional(v.id("organizations")),
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
    orgId: v.optional(v.id("organizations")),
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
    orgId: v.optional(v.id("organizations")),
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
    orgId: v.optional(v.id("organizations")),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
