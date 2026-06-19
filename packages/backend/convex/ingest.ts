import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { readConfig } from "./settings";
import { logEvent } from "./events";

/**
 * Server-side persistence for agent samples. This is the ONLY place samples
 * become durable, and it is an internal mutation — reachable only from the
 * authenticated `/ingest` HTTP action (see http.ts), never from clients.
 *
 * Responsibilities:
 *   - Auto-register unknown devices as `pending`; refresh known ones.
 *   - Silently drop samples from `disabled` devices (still 200 to the agent;
 *     the agent is a dumb sender and shouldn't care).
 *   - Append raw samples to `activitySamples`.
 *   - Incrementally accrue active/idle seconds into `dailyStats`, attributing
 *     the wall-clock gap since the device's previous sample to active or idle.
 */

// Largest gap (ms) we'll attribute to a single sample. Bounds the damage from a
// device that was offline for hours then dumps a backlog, or a clock jump.
const MAX_ATTRIBUTION_MS = 120_000;
// Nominal interval credited to the first-ever sample from a device (≈ poll).
const NOMINAL_FIRST_MS = 15_000;
// Real-world timezone range is UTC−12 to UTC+14 (840 minutes). Anything beyond
// this is a device bug; we clamp to UTC (0) to avoid attributing stats to a
// nonsensical date.
const MAX_TZ_OFFSET_MINUTES = 840;
// Minimum spacing between accepted ingest batches per device. The agent flushes
// every ~30s, so a legitimate device never approaches this; it only bounds
// write-amplification from a leaked/replayed device key. Generous on purpose —
// tune down if you tighten the agent's flush cadence. (Flagged default.)
const MIN_INGEST_INTERVAL_MS = 3_000;

const sampleValidator = v.object({
  deviceId: v.string(),
  windowsUser: v.string(),
  hostname: v.string(),
  idleMs: v.number(),
  active: v.boolean(),
  capturedAt: v.number(),
  tzOffsetMinutes: v.number(),
  agentVersion: v.string(),
  platform: v.string(),
});

/** YYYY-MM-DD for an epoch ms instant, in the device's local timezone. */
function localDay(capturedAt: number, tzOffsetMinutes: number): string {
  const localMs = capturedAt - tzOffsetMinutes * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}

export const recordSamples = internalMutation({
  args: {
    samples: v.array(sampleValidator),
  },
  handler: async (ctx, { samples }) => {
    const receivedAt = Date.now();
    // Idle→inactive threshold (Settings → Configuration). Daily active/idle
    // accrual is derived from each sample's idleMs against this, so changing it
    // reshapes the rollups going forward.
    const inactivityMs =
      (await readConfig(ctx)).inactivityThresholdSeconds * 1000;

    // Process per device, oldest sample first, so gap attribution is correct.
    const byDevice = new Map<string, typeof samples>();
    for (const s of samples) {
      const list = byDevice.get(s.deviceId) ?? [];
      list.push(s);
      byDevice.set(s.deviceId, list);
    }

    let inserted = 0;
    let throttled = false;
    for (const [deviceId, deviceSamples] of byDevice) {
      deviceSamples.sort((a, b) => a.capturedAt - b.capturedAt);

      let device = await getDevice(ctx, deviceId);
      // Disabled devices are ignored entirely (no rows written).
      if (device && device.status === "disabled") continue;

      // Per-device rate limit: drop (and signal 429 to the caller, so the agent
      // keeps the batch and retries) when batches arrive faster than a real
      // agent ever would. No row is written, so a flood can't amplify writes.
      if (
        device?.lastIngestAt !== undefined &&
        receivedAt - device.lastIngestAt < MIN_INGEST_INTERVAL_MS
      ) {
        throttled = true;
        continue;
      }

      // Running cursor for gap attribution within this batch.
      let prevCapturedAt = device?.lastSeen;

      for (const s of deviceSamples) {
        if (Math.abs(s.tzOffsetMinutes) > MAX_TZ_OFFSET_MINUTES) {
          await logEvent(ctx, {
            severity: "warning",
            source: "backend",
            code: "ingest.bad_tz_offset",
            message: `Device ${deviceId} sent tzOffsetMinutes=${s.tzOffsetMinutes}, clamped to 0`,
            deviceId,
            hostname: s.hostname,
          });
          s.tzOffsetMinutes = 0;
        }

        await ctx.db.insert("activitySamples", { ...s, receivedAt });
        inserted++;

        // Attribute elapsed wall-clock time to active or idle.
        const rawGap =
          prevCapturedAt === undefined
            ? NOMINAL_FIRST_MS
            : s.capturedAt - prevCapturedAt;
        const gapMs = Math.max(0, Math.min(rawGap, MAX_ATTRIBUTION_MS));
        prevCapturedAt = s.capturedAt;

        await accrueDaily(ctx, deviceId, s, gapMs, inactivityMs);
      }

      // Upsert the device row from the newest sample we saw.
      const newest = deviceSamples[deviceSamples.length - 1]!;
      if (device) {
        await ctx.db.patch(device._id, {
          hostname: newest.hostname,
          lastWindowsUser: newest.windowsUser,
          lastSeen: Math.max(device.lastSeen, newest.capturedAt),
          agentVersion: newest.agentVersion,
          // A previously-pending device stays pending until an admin approves.
          status: device.status,
          lastIngestAt: receivedAt,
        });
      } else {
        await ctx.db.insert("devices", {
          deviceId,
          hostname: newest.hostname,
          lastWindowsUser: newest.windowsUser,
          status: "pending",
          lastSeen: newest.capturedAt,
          agentVersion: newest.agentVersion,
          lastIngestAt: receivedAt,
        });
      }
    }

    return { inserted, throttled };
  },
});

async function getDevice(
  ctx: MutationCtx,
  deviceId: string,
): Promise<Doc<"devices"> | null> {
  return await ctx.db
    .query("devices")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
}

async function accrueDaily(
  ctx: MutationCtx,
  deviceId: string,
  sample: { idleMs: number; capturedAt: number; tzOffsetMinutes: number },
  gapMs: number,
  inactivityMs: number,
): Promise<void> {
  // Count the interval as active when the sample's idle time is under the
  // configured inactivity threshold; otherwise idle. The classification applies
  // to the whole attributed interval [start, end].
  const isActive = sample.idleMs < inactivityMs;
  const tz = sample.tzOffsetMinutes;
  const end = sample.capturedAt;
  const start = end - gapMs;

  // Split [start, end] at local-day boundaries so a gap that straddles local
  // midnight credits each day its real share. Previously the entire gap landed
  // on the end day, over-counting that day and under-counting the previous one
  // for batches that crossed midnight. The gap is capped at MAX_ATTRIBUTION_MS
  // (2 min), so this is at most a two-way split in practice.
  let segStart = start;
  while (segStart < end) {
    const day = localDay(segStart, tz);
    // Epoch ms of the start of the NEXT local day after `day`.
    const dayStartLocalMs = Date.parse(`${day}T00:00:00.000Z`);
    const nextDayEpoch = dayStartLocalMs + 24 * 60 * 60_000 + tz * 60_000;
    const segEnd = Math.min(end, nextDayEpoch);
    const seconds = (segEnd - segStart) / 1000;
    if (seconds > 0) {
      await accrueDay(
        ctx,
        deviceId,
        day,
        isActive ? seconds : 0,
        isActive ? 0 : seconds,
        segStart,
        segEnd,
      );
    }
    segStart = segEnd;
  }
}

async function accrueDay(
  ctx: MutationCtx,
  deviceId: string,
  day: string,
  activeDelta: number,
  idleDelta: number,
  firstSeen: number,
  lastSeen: number,
): Promise<void> {
  const existing = await ctx.db
    .query("dailyStats")
    .withIndex("by_device_day", (q) =>
      q.eq("deviceId", deviceId).eq("day", day),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      activeSeconds: existing.activeSeconds + activeDelta,
      idleSeconds: existing.idleSeconds + idleDelta,
      firstSeen: Math.min(existing.firstSeen, firstSeen),
      lastSeen: Math.max(existing.lastSeen, lastSeen),
    });
  } else {
    await ctx.db.insert("dailyStats", {
      deviceId,
      day,
      activeSeconds: activeDelta,
      idleSeconds: idleDelta,
      firstSeen,
      lastSeen,
    });
  }
}
