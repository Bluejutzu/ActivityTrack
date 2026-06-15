"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import {
  normalizePresence,
  normalizeRoutingStatus,
  isWrapUpPresence,
  type GenesysPresence,
  type GenesysRoutingStatus,
} from "@activitytrack/shared";

/**
 * Genesys + Clockodo HTTP clients and the scheduled poller, running INSIDE
 * Convex (Node runtime).
 *
 * Polling lives here — not on a Vercel Cron — because Convex crons run on the
 * free tier and can fire every minute (Vercel Hobby crons are once-a-day).
 * Secrets come from the Convex deployment env. Persistence reuses the same
 * secret-guarded `state.*` functions the rest of the system uses, so there's a
 * single write path.
 *
 * Resilience: each source is isolated in try/catch and reports health instead
 * of throwing, so one integration being down never affects the other or the
 * fused state.
 */

function signalSecret(): string {
  const s = process.env.ACTIVITYTRACK_SIGNAL_SECRET;
  if (!s) throw new Error("ACTIVITYTRACK_SIGNAL_SECRET is not configured");
  return s;
}

function healthStatusOf(err: unknown): "unavailable" | "unconfigured" {
  const msg = err instanceof Error ? err.message : String(err);
  return /not configured|not set/i.test(msg) ? "unconfigured" : "unavailable";
}
const errMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);
const today = () => new Date().toISOString().slice(0, 10);

// --- Genesys ---------------------------------------------------------------

const GENESYS_REGION = () => process.env.GENESYS_REGION ?? "mypurecloud.de";

let genesysToken: { accessToken: string; expiresAt: number } | null = null;

async function genesysAccessToken(): Promise<string> {
  if (genesysToken && Date.now() < genesysToken.expiresAt) {
    return genesysToken.accessToken;
  }
  const clientId = process.env.GENESYS_CLIENT_ID;
  const clientSecret = process.env.GENESYS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GENESYS_CLIENT_ID / GENESYS_CLIENT_SECRET not configured");
  }
  // btoa is fine here: Genesys client id/secret are ASCII.
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`https://login.${GENESYS_REGION()}/oauth/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Genesys token request failed: ${res.status}`);
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  genesysToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  return genesysToken.accessToken;
}

async function genesysGet<T>(path: string): Promise<T> {
  const token = await genesysAccessToken();
  const res = await fetch(`https://api.${GENESYS_REGION()}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Genesys GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function fetchGenesysUserState(genesysUserId: string): Promise<{
  routingStatus?: GenesysRoutingStatus;
  presence?: GenesysPresence;
  wrapUp: boolean;
}> {
  const [routing, presence] = await Promise.all([
    genesysGet<{ status?: string }>(
      `/api/v2/users/${genesysUserId}/routingstatus`,
    ),
    genesysGet<{ presenceDefinition?: { systemPresence?: string } }>(
      `/api/v2/users/${genesysUserId}/presences/purecloud`,
    ),
  ]);
  const system = presence.presenceDefinition?.systemPresence;
  return {
    routingStatus: normalizeRoutingStatus(routing.status),
    presence: normalizePresence(system),
    wrapUp: isWrapUpPresence(system),
  };
}

// --- Clockodo --------------------------------------------------------------

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
  if (!res.ok) throw new Error(`Clockodo GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

interface Absence {
  users_id?: number;
  date_since?: string;
  date_until?: string;
  status?: number;
}

async function fetchAbsences(year: number): Promise<Absence[]> {
  const body = await clockodoGet<{ absences: Absence[] }>(
    `/api/v2/absences?year=${year}`,
  );
  return body.absences ?? [];
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

async function fetchClockodoRunning(): Promise<{ services_id?: number } | null> {
  const body = await clockodoGet<{ running: { services_id?: number } | null }>(
    "/api/v2/entries/current",
  );
  return body.running ?? null;
}

function breakServiceIds(): Set<string> {
  return new Set(
    (process.env.CLOCKODO_BREAK_SERVICE_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// --- Persistence helpers (single guarded write path) -----------------------

async function pushGenesys(
  ctx: ActionCtx,
  employeeId: string,
  s: { routingStatus?: GenesysRoutingStatus; presence?: GenesysPresence; wrapUp: boolean },
) {
  await ctx.runMutation(api.state.pushSignal, {
    secret: signalSecret(),
    employeeId,
    source: "genesys",
    genesysRoutingStatus: s.routingStatus,
    genesysPresence: s.presence,
    genesysWrapUp: s.wrapUp,
  });
}

async function reportHealth(
  ctx: ActionCtx,
  source: "genesys" | "clockodo",
  status: "ok" | "unavailable" | "unconfigured",
  message?: string,
) {
  try {
    await ctx.runMutation(api.state.reportHealth, {
      secret: signalSecret(),
      source,
      status,
      message: message?.slice(0, 300),
    });
  } catch {
    // health is informational; never let it break the poll
  }
}

// --- Public / scheduled entry points ---------------------------------------

/** Scheduled by Convex cron. Polls every configured source for all people. */
export const pollAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const secret = signalSecret();
    const mappings = await ctx.runQuery(api.state.mappings, { secret });

    // Genesys: per-user routing status + presence.
    const genesysPeople = mappings.filter((p) => p.genesysUserId);
    if (genesysPeople.length > 0) {
      try {
        for (const p of genesysPeople) {
          const s = await fetchGenesysUserState(p.genesysUserId!);
          await pushGenesys(ctx, p.employeeId, s);
        }
        await reportHealth(ctx, "genesys", "ok");
      } catch (err) {
        await reportHealth(ctx, "genesys", healthStatusOf(err), errMessage(err));
      }
    }

    // Clockodo: org-wide approved absences (the override the agent can't see).
    const clockodoPeople = mappings.filter((p) => p.clockodoUserId);
    if (clockodoPeople.length > 0) {
      try {
        const absences = await fetchAbsences(new Date().getFullYear());
        const day = today();
        for (const p of clockodoPeople) {
          await ctx.runMutation(api.state.pushSignal, {
            secret,
            employeeId: p.employeeId,
            source: "clockodo",
            clockodoAbsent: isAbsentOn(absences, p.clockodoUserId!, day),
          });
        }
        await reportHealth(ctx, "clockodo", "ok");
      } catch (err) {
        await reportHealth(ctx, "clockodo", healthStatusOf(err), errMessage(err));
      }
    }
  },
});

/** On-demand single-user Genesys sync (used by the dashboard /sync endpoint). */
export const syncGenesys = action({
  args: {
    secret: v.string(),
    employeeId: v.string(),
    genesysUserId: v.string(),
  },
  handler: async (ctx, { secret, employeeId, genesysUserId }) => {
    if (secret !== process.env.ACTIVITYTRACK_SIGNAL_SECRET) {
      return { ok: false, error: "forbidden" as const };
    }
    try {
      const s = await fetchGenesysUserState(genesysUserId);
      await pushGenesys(ctx, employeeId, s);
      await reportHealth(ctx, "genesys", "ok");
      return { ok: true as const };
    } catch (err) {
      await reportHealth(ctx, "genesys", healthStatusOf(err), errMessage(err));
      return { ok: false, error: "genesys_unavailable" as const };
    }
  },
});

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
      const [running, absences] = await Promise.all([
        fetchClockodoRunning(),
        fetchAbsences(new Date().getFullYear()),
      ]);
      const absent = isAbsentOn(absences, clockodoUserId, day);
      const onBreak =
        running != null &&
        running.services_id != null &&
        breakServiceIds().has(String(running.services_id));
      await ctx.runMutation(api.state.pushSignal, {
        secret,
        employeeId,
        source: "clockodo",
        clockodoWorking: running != null && !onBreak,
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
