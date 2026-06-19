import "server-only";
import { activityUpdateSchema } from "@activitytrack/shared";
import {
  bearer,
  fail,
  keyMatches,
  ok,
  pushSignal,
  type IngressRequest,
  type IngressResult,
} from "./shared";

/**
 * POST /api/activity/update — desktop agent workstation heartbeat. The agent
 * only reports the workstation; telephony/time-tracking are fused server-side.
 * Authenticated by the shared ingest key.
 */
export async function ingestAgentHeartbeat(
  req: IngressRequest,
): Promise<IngressResult> {
  if (!keyMatches(bearer(req.headers), process.env.ACTIVITYTRACK_INGEST_KEY)) {
    return fail(401, "unauthorized");
  }
  const parsed = activityUpdateSchema.safeParse(req.body);
  if (!parsed.success) return fail(400, "bad_request");

  const { employeeId, deviceIdle, idleSeconds } = parsed.data;
  const { finalState } = await pushSignal({
    employeeId,
    source: "agent",
    deviceIdle,
    idleSeconds,
  });
  return ok({ finalState });
}
