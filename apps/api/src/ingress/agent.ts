import { activityUpdateSchema } from "@activitytrack/shared";
import {
  bearer,
  claimDeviceToken,
  fail,
  ok,
  pushSignal,
  requestEnrollment,
  validateDeviceToken,
  type IngressRequest,
  type IngressResult,
} from "./shared";

/** Read a required string field from an unknown JSON body, or null. */
function str(body: unknown, key: string): string | null {
  const v = (body as Record<string, unknown> | null | undefined)?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * POST /agent/register — desktop agent self-registration. Unauthenticated by
 * design: the agent holds only a locally-generated one-time pairing nonce.
 * It lands in the pending queue for an admin to approve.
 */
export async function registerAgent(req: IngressRequest): Promise<IngressResult> {
  const deviceId = str(req.body, "deviceId");
  const hostname = str(req.body, "hostname");
  const windowsUser = str(req.body, "windowsUser");
  const agentVersion = str(req.body, "agentVersion");
  const claimNonce = str(req.body, "claimNonce");
  if (!deviceId || !hostname || !windowsUser || !agentVersion || !claimNonce) {
    return fail(400, "bad_request");
  }
  const { status } = await requestEnrollment({
    deviceId,
    hostname,
    windowsUser,
    agentVersion,
    claimNonce,
  });
  return ok({ status });
}

/**
 * POST /agent/poll — the agent polls with its deviceId + pairing nonce until
 * approved; on the first approved poll the response carries the freshly minted
 * device token, the agent's one chance to capture it.
 */
export async function pollAgent(req: IngressRequest): Promise<IngressResult> {
  const deviceId = str(req.body, "deviceId");
  const claimNonce = str(req.body, "claimNonce");
  if (!deviceId || !claimNonce) return fail(400, "bad_request");
  const result = await claimDeviceToken({ deviceId, claimNonce });
  return ok(result as Record<string, unknown>);
}

/**
 * POST /activity/update — desktop agent workstation heartbeat.
 * Authenticated by the per-device token.
 */
export async function ingestAgentHeartbeat(
  req: IngressRequest,
): Promise<IngressResult> {
  const token = bearer(req.headers);
  if (!token || !(await validateDeviceToken(token))) {
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
