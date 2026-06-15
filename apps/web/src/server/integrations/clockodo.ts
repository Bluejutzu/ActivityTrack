import "server-only";
import type { ClockodoSignal } from "@activitytrack/shared";

/**
 * Clockodo client — time-tracking truth (working / break / absent).
 *
 * Auth is via the documented header triple. Break detection keys off a
 * configurable set of "break" service ids (CLOCKODO_BREAK_SERVICE_IDS): a
 * running entry whose service is a break service means BREAK, any other running
 * entry means WORKING. Absence is read from the absences endpoint.
 */

const BASE = process.env.CLOCKODO_BASE_URL ?? "https://my.clockodo.com";

function authHeaders(): Record<string, string> {
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

function breakServiceIds(): Set<string> {
  return new Set(
    (process.env.CLOCKODO_BREAK_SERVICE_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

async function clockodoGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Clockodo GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

interface RunningEntry {
  users_id?: number;
  services_id?: number;
}

interface Absence {
  users_id?: number;
  /** YYYY-MM-DD */
  date_since?: string;
  date_until?: string;
  /** 0=requested, 1=approved, 2=declined, 3=approved-cancellation, … */
  status?: number;
}

/** GET /api/v2/entries/current — the user's currently-running entry, if any. */
export async function fetchCurrentEntry(): Promise<RunningEntry | null> {
  const body = await clockodoGet<{ running: RunningEntry | null }>(
    "/api/v2/entries/current",
  );
  return body.running ?? null;
}

/** GET /api/v2/absences — used to decide whether an approved absence is active. */
export async function fetchAbsences(year: number): Promise<Absence[]> {
  const body = await clockodoGet<{ absences: Absence[] }>(
    `/api/v2/absences?year=${year}`,
  );
  return body.absences ?? [];
}

/** Is `clockodoUserId` covered by an approved absence on `day` (YYYY-MM-DD)? */
export function isAbsentOn(
  absences: Absence[],
  clockodoUserId: string,
  day: string,
): boolean {
  const uid = Number(clockodoUserId);
  return absences.some((a) => {
    if (a.users_id !== uid) return false;
    if (a.status !== 1) return false; // approved only
    if (!a.date_since || !a.date_until) return false;
    return a.date_since <= day && day <= a.date_until;
  });
}

/**
 * Build a normalized Clockodo signal for one employee from a running entry and
 * the absence list. `running` belongs to this user (the caller filters/fetches
 * per user); pass null when nothing is running.
 */
export function toSignal(
  employeeId: string,
  clockodoUserId: string,
  running: RunningEntry | null,
  absences: Absence[],
  day: string,
): ClockodoSignal {
  const absent = isAbsentOn(absences, clockodoUserId, day);
  const isRunning = running != null;
  const onBreak =
    isRunning &&
    running!.services_id != null &&
    breakServiceIds().has(String(running!.services_id));
  return {
    employeeId,
    working: isRunning && !onBreak,
    onBreak,
    absent,
  };
}
