import { api } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

/**
 * Cross-integration helpers shared by the Genesys and Clockodo clients and the
 * poll orchestrator. Kept in its own module (no Convex functions, no "use node")
 * so the per-source clients (`genesys.ts`, `clockodo.ts`) and the orchestrator
 * (`integrations.ts`) stay small and focused.
 */

/** The server-to-server secret guarding every `state.*` write. */
export function signalSecret(): string {
  const s = process.env.ACTIVITYTRACK_SIGNAL_SECRET;
  if (!s) throw new Error("ACTIVITYTRACK_SIGNAL_SECRET is not configured");
  return s;
}

/** Classify a thrown error as a missing-config vs a transient outage. */
export function healthStatusOf(err: unknown): "unavailable" | "unconfigured" {
  const msg = err instanceof Error ? err.message : String(err);
  return /not configured|not set/i.test(msg) ? "unconfigured" : "unavailable";
}

export const errMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/** Today as YYYY-MM-DD (UTC). */
export const today = () => new Date().toISOString().slice(0, 10);

/** The external-id map for every active person, as returned by `state.mappings`. */
export interface Mapping {
  employeeId: string;
  genesysUserId: string | null;
  clockodoUserId: string | null;
}

/**
 * Report an integration source's health. Informational only — a failure here
 * never blocks or rolls back the signal it accompanies.
 */
export async function reportHealth(
  ctx: ActionCtx,
  source: "genesys" | "clockodo",
  status: "ok" | "unavailable" | "unconfigured",
  message?: string,
): Promise<void> {
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
