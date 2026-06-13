import type { AgentConfig } from "./config.js";
import type { ActivitySample } from "@activitytrack/shared";

/**
 * Ships a batch of samples to the Convex HTTP ingest endpoint. The desktop app
 * does NO validation of its own beyond shaping the payload — all trust/schema
 * checks happen server-side (see packages/backend). We only need to be a
 * reliable, dumb sender.
 *
 * Returns true on success (2xx). On any failure we keep the batch in the queue.
 */
export async function sendBatch(
  config: AgentConfig,
  batch: ActivitySample[],
): Promise<boolean> {
  if (!config.convexUrl || batch.length === 0) return batch.length === 0;
  try {
    const res = await fetch(`${config.convexUrl}/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.ingestKey}`,
      },
      body: JSON.stringify({ samples: batch }),
      // Don't let a hung socket wedge the agent forever.
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
