import { clockodoSignalSchema } from "@activitytrack/shared";
import { convex, api, signalSecret } from "../convex";
import {
  bearer,
  fail,
  keyMatches,
  ok,
  passthrough,
  pushSignal,
  type IngressRequest,
  type IngressResult,
} from "./shared";

/**
 * Clockodo echoes the value configured in its webhook "Token" field back in
 * every event body. Accept it against the dedicated token or — for setups that
 * reuse one secret — the shared webhook secret.
 */
function tokenOk(token: string | null): boolean {
  if (!token) return false;
  return (
    keyMatches(token, process.env.CLOCKODO_WEBHOOK_TOKEN) ||
    keyMatches(token, process.env.ACTIVITYTRACK_WEBHOOK_SECRET)
  );
}

/**
 * POST /webhooks/clockodo — Clockodo time-tracking webhook. Handles three shapes:
 *
 *   A. Validation handshake — `{ secret }` on create / URL change. We log it
 *      and 200 so validation passes.
 *   B. Native event — `{ event_name, payload: { entry: { id } }, token }`.
 *      Clockodo sends only the entry id; Convex fetches + resolves + re-pulls.
 *   C. Legacy — a normalized ClockodoSignal, or `{ employeeId, clockodoUserId }`
 *      for an authoritative re-pull. Guarded by the Bearer / ?secret= key.
 */
export async function ingestClockodoWebhook(
  req: IngressRequest,
): Promise<IngressResult> {
  const b = (req.body ?? {}) as Record<string, unknown>;

  // A. Validation handshake — surface the secret and acknowledge.
  if (typeof b.secret === "string" && !b.event_name && !b.employeeId) {
    console.log(`[clockodo] webhook validation secret: ${b.secret}`);
    return ok();
  }

  // B. Native Clockodo event (entry.created / .updated / .stopped / .deleted).
  if (typeof b.event_name === "string") {
    const token = typeof b.token === "string" ? b.token : null;
    if (!tokenOk(token)) return fail(401, "unauthorized");
    const payload = (b.payload ?? {}) as { entry?: { id?: number | string } };
    const entryId = payload.entry?.id;
    console.log(
      `[clockodo] webhook received event=${b.event_name} entryId=${entryId ?? "—"}`,
    );
    // Acknowledge events without an entry id so Clockodo doesn't retry them.
    if (entryId == null) return ok({ ignored: true });
    const result = await convex.action(api.clockodo.refreshClockodoByEntry, {
      secret: signalSecret(),
      entryId: String(entryId),
      eventName: b.event_name,
    });
    return passthrough(result);
  }

  // C. Legacy adapter shapes — keep the Bearer / ?secret= guard.
  const secret = bearer(req.headers) ?? req.query.secret ?? null;
  if (!keyMatches(secret, process.env.ACTIVITYTRACK_WEBHOOK_SECRET)) {
    return fail(401, "unauthorized");
  }

  const raw = b as { employeeId?: string; clockodoUserId?: string };
  if (raw.employeeId && raw.clockodoUserId) {
    const result = await convex.action(api.clockodo.refreshClockodo, {
      secret: signalSecret(),
      employeeId: raw.employeeId,
      clockodoUserId: raw.clockodoUserId,
    });
    return passthrough(result);
  }

  const parsed = clockodoSignalSchema.safeParse(req.body);
  if (!parsed.success) return fail(400, "bad_request");
  const { employeeId, working, onBreak, absent } = parsed.data;
  const { finalState } = await pushSignal({
    employeeId,
    source: "clockodo",
    clockodoWorking: working,
    clockodoBreak: onBreak,
    clockodoAbsent: absent,
  });
  return ok({ finalState });
}
