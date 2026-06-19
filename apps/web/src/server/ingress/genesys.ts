import "server-only";
import { genesysSignalSchema } from "@activitytrack/shared";
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

const webhookSecret = () => process.env.ACTIVITYTRACK_WEBHOOK_SECRET;

/**
 * POST /api/integrations/genesys/notify — relay for Genesys notifications. The
 * optional WebSocket worker posts a normalized event here; we push it.
 */
export async function ingestGenesysNotify(
  req: IngressRequest,
): Promise<IngressResult> {
  if (!keyMatches(bearer(req.headers), webhookSecret())) {
    return fail(401, "unauthorized");
  }
  const parsed = genesysSignalSchema.safeParse(req.body);
  if (!parsed.success) return fail(400, "bad_request");

  const { employeeId, routingStatus, presence, wrapUp } = parsed.data;
  const { finalState } = await pushSignal({
    employeeId,
    source: "genesys",
    genesysRoutingStatus: routingStatus,
    genesysPresence: presence,
    genesysWrapUp: wrapUp,
  });
  return ok({ finalState });
}

/**
 * POST /api/integrations/genesys/sync — on-demand single-user pull. Delegates to
 * the Convex action, which fetches from Genesys and records health.
 * Body: { employeeId, genesysUserId }.
 */
export async function ingestGenesysSync(
  req: IngressRequest,
): Promise<IngressResult> {
  if (!keyMatches(bearer(req.headers), webhookSecret())) {
    return fail(401, "unauthorized");
  }
  const b = req.body as { employeeId?: string; genesysUserId?: string };
  if (!b?.employeeId || !b?.genesysUserId) return fail(400, "bad_request");

  const result = await convex.action(api.genesys.syncGenesys, {
    secret: signalSecret(),
    employeeId: b.employeeId,
    genesysUserId: b.genesysUserId,
  });
  return passthrough(result);
}
