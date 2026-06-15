import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@activitytrack/backend/convex/_generated/api";

/**
 * Server-to-server bridge from the Elysia API layer to Convex.
 *
 * The dashboard's reactive reads use the Convex React client (Clerk-gated). The
 * *write* side — pushing fused signals from the agent / Genesys / Clockodo — is
 * server-only and authenticates with a shared secret instead of a user session,
 * so it goes through this plain HTTP client. The secret never reaches the
 * browser (no NEXT_PUBLIC_ prefix).
 */

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  // Surfaced at import time on the server so a misconfig fails loudly in logs.
  console.warn(
    "[server] NEXT_PUBLIC_CONVEX_URL is not set — signal ingestion will fail.",
  );
}

export const convex = new ConvexHttpClient(url ?? "");

/** The shared secret the Elysia layer presents to Convex `state.pushSignal`. */
export function signalSecret(): string {
  const secret = process.env.ACTIVITYTRACK_SIGNAL_SECRET;
  if (!secret) {
    throw new Error("ACTIVITYTRACK_SIGNAL_SECRET is not configured");
  }
  return secret;
}

/**
 * Record an integration's health. Best-effort and never throws — a down source
 * must not break the request that noticed it. Surfaces on the dashboard as
 * "<source> unavailable due to <message>".
 */
export async function reportHealth(
  source: "genesys" | "clockodo",
  status: "ok" | "unavailable" | "unconfigured",
  message?: string,
): Promise<void> {
  try {
    await convex.mutation(api.state.reportHealth, {
      secret: signalSecret(),
      source,
      status,
      message: message?.slice(0, 300),
    });
  } catch (err) {
    console.error("[server] reportHealth failed:", err);
  }
}

export { api };
