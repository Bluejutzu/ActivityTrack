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
if (!process.env.ACTIVITYTRACK_SIGNAL_SECRET) {
  // Same boot-time surfacing: previously this only blew up on the first signal
  // push (deep in a request), which is easy to miss. Warn at module load so a
  // missing secret is obvious in startup logs. `signalSecret()` still hard-throws
  // on use, so requests fail closed — they never run unauthenticated.
  console.warn(
    "[server] ACTIVITYTRACK_SIGNAL_SECRET is not set — signal ingestion will be rejected.",
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

export { api };
