"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import {
  signalSecret,
  reportHealth,
  healthStatusOf,
  errMessage,
  today,
  type Mapping,
} from "./integrationsShared";

/**
 * Clockodo time-tracking client, running inside Convex's Node runtime. The team
 * uses Clockodo's clock as their attendance signal: an open (running) entry means
 * working; dropping the clock mid-day is their "break". The HTTP wrappers, the
 * webhook/on-demand re-pull actions, and the poll slice live here; the scheduled
 * orchestrator in `integrations.ts` calls `pollClockodo`.
 */

const CLOCKODO_BASE = () =>
  process.env.CLOCKODO_BASE_URL ?? "https://my.clockodo.com";

function clockodoHeaders(): Record<string, string> {
  const apiUser = process.env.CLOCKODO_API_USER;
  const apiKey = process.env.CLOCKODO_API_KEY;
  if (!apiUser || !apiKey) {
    throw new Error("CLOCKODO_API_USER / CLOCKODO_API_KEY not configured");
  }
  return {
    "X-ClockodoApiUser": apiUser,
    "X-ClockodoApiKey": apiKey,
    "X-Clockodo-External-Application": "ActivityTrack",
  };
}

async function clockodoGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CLOCKODO_BASE()}${path}`, {
    headers: clockodoHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    console.log(text);
    throw new Error(`Clockodo GET ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

interface Absence {
  users_id?: number;
  date_since?: string;
  date_until?: string;
  status?: number;
}

async function fetchAbsences(year: number): Promise<Absence[]> {
  const qs = `year=${year}&filter[scope]=viewableAbsences`;
  const body = await clockodoGet<{ data?: Absence[] }>(`/api/v4/absences?${qs}`);
  return body.data ?? [];
}

function isAbsentOn(
  absences: Absence[],
  clockodoUserId: string,
  day: string,
): boolean {
  const uid = Number(clockodoUserId);
  return absences.some(
    (a) =>
      a.users_id === uid &&
      a.status === 1 && // approved
      !!a.date_since &&
      !!a.date_until &&
      a.date_since <= day &&
      day <= a.date_until,
  );
}

function clockodoDate(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

interface ClockodoEntry {
  users_id?: number;
  // `clocked: true` means the entry is currently running (clock still ticking).
  // `time_until` is always present in the response even for running entries, so
  // it cannot be used to detect a running clock.
  clocked?: boolean;
  // A running (clocked-in) entry has no end yet. Closed entries carry a value.
  time_until?: string | null;
}

/**
 * A user's time entries for today. Uses `/api/v2/entries` with the documented
 * `time_since`/`time_until` range and a `filter[users_id]` — the only path that
 * works cross-user with one admin API key. (Note: `/api/v2/clock` only ever
 * returns the *authenticated* API user's own running clock, so it can't be used
 * to read other employees' state — that was the broken assumption before.)
 */
async function fetchTodayEntries(clockodoUserId: string): Promise<ClockodoEntry[]> {
  const day = today();
  const qs = [
    `time_since=${encodeURIComponent(`${day}T00:00:00Z`)}`,
    `time_until=${encodeURIComponent(clockodoDate())}`,
    `filter[users_id]=${encodeURIComponent(clockodoUserId)}`,
  ].join("&");
  const body = await clockodoGet<{ entries?: ClockodoEntry[] }>(
    `/api/v2/entries?${qs}`,
  );
  return body.entries ?? [];
}

/**
 * Derive Clockodo working/break from today's entries, implementing the team's
 * "no break services — dropping the clock is the break" rule:
 *   - an open entry (no end yet) → clocked in → working;
 *   - entries today but none open → clock stopped mid-day → on break;
 *   - no entries today → off-shift (neither working nor break; absence, if any,
 *     is handled separately).
 */
async function fetchClockodoWork(clockodoUserId: string): Promise<{
  working: boolean;
  onBreak: boolean;
}> {
  const entries = await fetchTodayEntries(clockodoUserId);
  if (entries.length === 0) return { working: false, onBreak: false };
  // `clocked: true` is the authoritative "running" indicator per the API docs.
  // `time_until` is always populated in the response, so null-checking it is wrong.
  const clockedIn = entries.some((e) => e.clocked === true);
  return { working: clockedIn, onBreak: !clockedIn };
}

/**
 * Look up a single entry by id, only to learn which Clockodo user it belongs to.
 * A webhook carries just the entry id, so we resolve the user, then read their
 * authoritative day state via `fetchClockodoWork`. Returns null when the entry
 * no longer exists (e.g. it was deleted).
 */
async function fetchClockodoEntryUserId(id: string): Promise<string | null> {
  const res = await fetch(`${CLOCKODO_BASE()}/api/v2/entries/${id}`, {
    headers: clockodoHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    console.log(text);
    throw new Error(`Clockodo GET entry ${id} failed: ${res.status} ${text}`);
  }
  const body = (await res.json()) as { entry?: ClockodoEntry };
  return body.entry?.users_id != null ? String(body.entry.users_id) : null;
}

/** Poll slice: org-wide approved absences + each mapped user's working/break state. */
export async function pollClockodo(
  ctx: ActionCtx,
  secret: string,
  mappings: Mapping[],
): Promise<void> {
  const clockodoPeople = mappings.filter((p) => p.clockodoUserId);
  if (clockodoPeople.length === 0) return;
  try {
    const absences = await fetchAbsences(new Date().getFullYear());
    const day = today();
    for (const p of clockodoPeople) {
      const work = await fetchClockodoWork(p.clockodoUserId!);
      await ctx.runMutation(api.state.pushSignal, {
        secret,
        employeeId: p.employeeId,
        source: "clockodo",
        clockodoWorking: work.working,
        clockodoBreak: work.onBreak,
        clockodoAbsent: isAbsentOn(absences, p.clockodoUserId!, day),
      });
    }
    await reportHealth(ctx, "clockodo", "ok");
  } catch (err) {
    await reportHealth(ctx, "clockodo", healthStatusOf(err), errMessage(err));
  }
}

/** On-demand Clockodo refresh for one user (used by the webhook re-pull path). */
export const refreshClockodo = action({
  args: {
    secret: v.string(),
    employeeId: v.string(),
    clockodoUserId: v.string(),
  },
  handler: async (ctx, { secret, employeeId, clockodoUserId }) => {
    if (secret !== process.env.ACTIVITYTRACK_SIGNAL_SECRET) {
      return { ok: false, error: "forbidden" as const };
    }
    try {
      const day = today();
      const [work, absences] = await Promise.all([
        fetchClockodoWork(clockodoUserId),
        fetchAbsences(new Date().getFullYear()),
      ]);
      const absent = isAbsentOn(absences, clockodoUserId, day);
      await ctx.runMutation(api.state.pushSignal, {
        secret,
        employeeId,
        source: "clockodo",
        clockodoWorking: work.working,
        clockodoBreak: work.onBreak,
        clockodoAbsent: absent,
      });
      await reportHealth(ctx, "clockodo", "ok");
      return { ok: true as const };
    } catch (err) {
      await reportHealth(ctx, "clockodo", healthStatusOf(err), errMessage(err));
      return { ok: false, error: "clockodo_unavailable" as const };
    }
  },
});

/**
 * Re-pull state from a Clockodo webhook event. Clockodo sends only the id of the
 * changed entry, so we fetch the entry, resolve the user behind it, and push the
 * derived working/break/absent state. Used by the `/api/webhooks/clockodo` route.
 *
 * `entry.stopped` is handled specially: stopping the clock IS the break gesture,
 * but Clockodo's entries API can still report the just-stopped entry as
 * `clocked: true` for a few seconds. Re-reading the day state there would race
 * and leave the person stuck showing "working", so we trust the event and set
 * not-working / on-break directly. Other events (created/updated/deleted) re-pull
 * the authoritative day state as before.
 */
export const refreshClockodoByEntry = action({
  args: {
    secret: v.string(),
    entryId: v.string(),
    eventName: v.optional(v.string()),
  },
  handler: async (ctx, { secret, entryId, eventName }) => {
    if (secret !== process.env.ACTIVITYTRACK_SIGNAL_SECRET) {
      return { ok: false, error: "forbidden" as const };
    }
    try {
      // The webhook only carries the entry id — read it to learn the user, then
      // resolve their day state cross-user (same path as `refreshClockodo`).
      const clockodoUserId = await fetchClockodoEntryUserId(entryId);
      // A deleted entry (or one with no user) carries nothing authoritative to
      // push — acknowledge without touching state so Clockodo won't retry.
      if (!clockodoUserId) {
        await reportHealth(ctx, "clockodo", "ok");
        return { ok: true as const, ignored: true as const };
      }

      const employeeId = await ctx.runQuery(api.state.resolveEmployeeId, {
        secret,
        clockodoUserId,
      });
      // The Clockodo user isn't mapped to anyone here — not an error.
      if (!employeeId) {
        await reportHealth(ctx, "clockodo", "ok");
        return { ok: true as const, unmapped: true as const };
      }

      // Absence is read regardless of the event type.
      const absences = await fetchAbsences(new Date().getFullYear());
      const absent = isAbsentOn(absences, clockodoUserId, today());

      let working: boolean;
      let onBreak: boolean;
      if (eventName === "entry.stopped") {
        // Trust the event over the eventually-consistent entries read.
        working = false;
        onBreak = true;
      } else {
        const work = await fetchClockodoWork(clockodoUserId);
        working = work.working;
        onBreak = work.onBreak;
      }

      await ctx.runMutation(api.state.pushSignal, {
        secret,
        employeeId,
        source: "clockodo",
        clockodoWorking: working,
        clockodoBreak: onBreak,
        clockodoAbsent: absent,
      });
      await reportHealth(ctx, "clockodo", "ok");
      return { ok: true as const };
    } catch (err) {
      await reportHealth(ctx, "clockodo", healthStatusOf(err), errMessage(err));
      return { ok: false, error: "clockodo_unavailable" as const };
    }
  },
});
