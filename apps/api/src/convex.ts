import { ConvexHttpClient } from "convex/browser";
import { api } from "@activitytrack/backend/convex/_generated/api";

/**
 * Server-to-server bridge from the Elysia API layer to Convex.
 *
 * Write-side signals (agent heartbeats, Genesys relay, Clockodo webhooks)
 * authenticate with a shared secret instead of a user session, so they go
 * through this plain HTTP client. The secret must never be exposed publicly.
 */

const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  console.warn(
    "[api] CONVEX_URL is not set — signal ingestion will fail.",
  );
}
if (!process.env.ACTIVITYTRACK_SIGNAL_SECRET) {
  console.warn(
    "[api] ACTIVITYTRACK_SIGNAL_SECRET is not set — signal ingestion will be rejected.",
  );
}

export const convex = new ConvexHttpClient(url ?? "");

/** The shared secret the API layer presents to Convex mutations. */
export function signalSecret(): string {
  const secret = process.env.ACTIVITYTRACK_SIGNAL_SECRET;
  if (!secret) {
    throw new Error("ACTIVITYTRACK_SIGNAL_SECRET is not configured");
  }
  return secret;
}

export { api };
