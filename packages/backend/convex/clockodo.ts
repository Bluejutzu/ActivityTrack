"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
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
  // `clocked: true` is the authoritative "running" indicator per the API docs.
  // `time_until` is always populated in the response, so null-checking it is wrong.
  const clockedIn = entries.some((e) => e.clocked === true);
  const result =
    entries.length === 0
      ? { working: false, onBreak: false }
      : { working: clockedIn, onBreak: !clockedIn };
  // Debug: the raw entries we read and the working/break we derived from them.
  console.log(
    `[clockodo] day state user=${clockodoUserId} entriesToday=${entries.length} clockedIn=${clockedIn} → working=${result.working} onBreak=${result.onBreak}`,
  );
  return result;
}

/**
 * Fetch a single entry by id. Returns the owning user id AND the entry's
 * current `clocked` state. Used by the webhook path to determine state directly
 * from the specific entry that changed, avoiding a full day-scan re-fetch that
 * races with Clockodo's eventual consistency.
 *
 * Returns `{ usersId: null, clocked: null }` when the entry is gone (deleted).
 */
async function fetchClockodoEntry(
  id: string,
): Promise<{ usersId: string | null; clocked: boolean | null }> {
  const res = await fetch(`${CLOCKODO_BASE()}/api/v2/entries/${id}`, {
    headers: clockodoHeaders(),
  });
  if (res.status === 404) return { usersId: null, clocked: null };
  if (!res.ok) {
    const text = await res.text();
    console.log(text);
    throw new Error(`Clockodo GET entry ${id} failed: ${res.status} ${text}`);
  }
  const body = (await res.json()) as { entry?: ClockodoEntry };
  return {
    usersId:
      body.entry?.users_id != null ? String(body.entry.users_id) : null,
    clocked: body.entry?.clocked ?? null,
  };
}

/** Poll slice: org-wide approved absences + each mapped user's working/break state. */
export async function pollClockodo(
  ctx: ActionCtx,
  secret: string,
  mappings: Mapping[],
): Promise<void> {
  const clockodoPeople = mappings.filter((p) => p.clockodoUserId);
  if (clockodoPeople.length === 0) return;
  console.log(`[clockodo] poll: ${clockodoPeople.length} mapped user(s)`);
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
 * Re-pull state from a Clockodo webhook event. Clockodo sends only the id of
 * the changed entry, so we fetch the entry (to learn the user AND its current
 * `clocked` state), then push the derived working/break/absent signal.
 *
 * State resolution per event type:
 *   entry.stopped  — trust the event directly (working=false, onBreak=true).
 *                    The entry's API state may still lag; the event is definitive.
 *   entry.created  — entry.clocked drives working/break (newly started = clocked).
 *   entry.updated  — same: use the entry's own `clocked` field, which reflects
 *                    its current state at the time Clockodo sent this webhook.
 *                    This replaces the former "re-scan all today's entries" approach
 *                    that raced with Clockodo's eventual consistency and could
 *                    revert a freshly stopped clock back to working.
 *
 * Note: GET /v2/clock is not usable here — it only returns the authenticated
 * API user's own running clock, not other employees' state.
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
      const { usersId: clockodoUserId, clocked: entryClocked } =
        await fetchClockodoEntry(entryId);

      if (!clockodoUserId) {
        console.log(
          `[clockodo] webhook entry=${entryId} event=${eventName ?? "—"} → no user (deleted?), ignored`,
        );
        await reportHealth(ctx, "clockodo", "ok");
        return { ok: true as const, ignored: true as const };
      }

      const employeeId = await ctx.runQuery(api.state.resolveEmployeeId, {
        secret,
        clockodoUserId,
      });
      if (!employeeId) {
        console.log(
          `[clockodo] webhook entry=${entryId} user=${clockodoUserId} → not mapped to an employee, skipped`,
        );
        await reportHealth(ctx, "clockodo", "ok");
        return { ok: true as const, unmapped: true as const };
      }

      const absences = await fetchAbsences(new Date().getFullYear());
      const absent = isAbsentOn(absences, clockodoUserId, today());

      let working: boolean;
      let onBreak: boolean;

      if (eventName === "entry.stopped") {
        // The stop event is definitive — the entry's API state may still show
        // clocked:true briefly due to eventual consistency.
        working = false;
        onBreak = true;
      } else {
        // For entry.created and entry.updated: the entry's own clocked field is
        // the authoritative source. Clockodo sets clocked:false on the entry
        // before sending entry.updated, so this avoids the race that caused a
        // freshly stopped clock to revert to working.
        working = entryClocked === true;
        onBreak = entryClocked === false;
      }

      const resolution =
        eventName === "entry.stopped"
          ? "trusted_stop"
          : entryClocked === true
            ? "entry_clocked_true"
            : "entry_clocked_false";

      console.log(
        `[clockodo] webhook entry=${entryId} event=${eventName ?? "—"} user=${clockodoUserId} employee=${employeeId} entryClocked=${entryClocked} → working=${working} onBreak=${onBreak} absent=${absent} (${resolution})`,
      );

      await ctx.runMutation(api.state.pushSignal, {
        secret,
        employeeId,
        source: "clockodo",
        clockodoWorking: working,
        clockodoBreak: onBreak,
        clockodoAbsent: absent,
      });

      // Log to the structured events table so IT can inspect webhook outcomes
      // without grepping through serverless logs.
      const logSeverity =
        working && eventName !== "entry.created" ? "warning" : "info";
      await ctx.runMutation(internal.events.record, {
        source: "backend",
        severity: logSeverity,
        code: `clockodo.webhook.${eventName ?? "unknown"}`,
        message: `entry=${entryId} employee=${employeeId} → working=${working} onBreak=${onBreak} (${resolution})`,
        context: JSON.stringify({
          eventName,
          entryId,
          clockodoUserId,
          employeeId,
          entryClocked,
          working,
          onBreak,
          absent,
        }),
      });

      await reportHealth(ctx, "clockodo", "ok");
      return { ok: true as const };
    } catch (err) {
      await reportHealth(ctx, "clockodo", healthStatusOf(err), errMessage(err));
      return { ok: false, error: "clockodo_unavailable" as const };
    }
  },
});
