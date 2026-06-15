import { ConvexHttpClient } from "convex/browser";
import { api } from "@activitytrack/backend/convex/_generated/api";
import {
  genesysTopicsForUser,
  parseGenesysNotification,
} from "@activitytrack/shared";
import { createNotificationsChannel, subscribeToTopics } from "./genesys";

/**
 * Genesys realtime notifications subscriber.
 *
 * Genesys has no outbound webhooks; its push transport is a notifications
 * WebSocket. A serverless route can't hold that socket open, so this runs as a
 * standalone long-lived worker:
 *
 *   1. fetch the active employee → genesysUserId map from Convex,
 *   2. create a notifications channel + subscribe to each user's topics,
 *   3. connect to the `wss://` connectUri and translate every event into a
 *      `state.pushSignal` write (the single source of truth).
 *
 * The channel's connection is auto-reconnected; on socket close we rebuild the
 * channel from scratch (channel ids are ephemeral). Node 20+/22 ships a global
 * `WebSocket`, so there is no extra dependency.
 *
 * Run: `pnpm --filter @activitytrack/web worker:genesys`
 */

const RECONNECT_DELAY_MS = 5_000;

function convexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

function signalSecret(): string {
  const s = process.env.ACTIVITYTRACK_SIGNAL_SECRET;
  if (!s) throw new Error("ACTIVITYTRACK_SIGNAL_SECRET is not set");
  return s;
}

async function run(): Promise<void> {
  const convex = convexClient();
  const secret = signalSecret();

  // 1. Who are we watching? Map genesysUserId → employeeId.
  const people = await convex.query(api.state.mappings, { secret });
  const byGenesysId = new Map<string, string>();
  for (const p of people) {
    if (p.genesysUserId) byGenesysId.set(p.genesysUserId, p.employeeId);
  }
  if (byGenesysId.size === 0) {
    console.warn("[genesys-worker] no people have a genesysUserId; idling.");
  }

  // 2. Channel + subscriptions.
  const channel = await createNotificationsChannel();
  const topics = [...byGenesysId.keys()].flatMap((id) =>
    genesysTopicsForUser(id),
  );
  if (topics.length > 0) {
    await subscribeToTopics(channel.id, topics);
  }
  console.log(
    `[genesys-worker] channel ${channel.id}, ${topics.length} topics, connecting…`,
  );

  // 3. Connect + dispatch.
  const ws = new WebSocket(channel.connectUri);

  ws.addEventListener("message", (ev: MessageEvent) => {
    void handleMessage(convex, secret, byGenesysId, ev.data);
  });
  ws.addEventListener("close", () => {
    console.warn(
      `[genesys-worker] socket closed; reconnecting in ${RECONNECT_DELAY_MS}ms`,
    );
    setTimeout(() => void run().catch(onFatal), RECONNECT_DELAY_MS);
  });
  ws.addEventListener("error", (e) => {
    console.error("[genesys-worker] socket error", e);
    // 'close' will follow and trigger the reconnect.
  });
}

async function handleMessage(
  convex: ConvexHttpClient,
  secret: string,
  byGenesysId: Map<string, string>,
  data: unknown,
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof data === "string" ? data : String(data));
  } catch {
    return;
  }
  const event = parseGenesysNotification(parsed);
  if (!event) return; // heartbeat / unrelated topic

  const employeeId = byGenesysId.get(event.genesysUserId);
  if (!employeeId) return; // not someone we track

  try {
    await convex.mutation(api.state.pushSignal, {
      secret,
      employeeId,
      source: "genesys",
      genesysRoutingStatus: event.routingStatus,
      genesysPresence: event.presence,
      genesysWrapUp: event.wrapUp,
    });
  } catch (err) {
    console.error("[genesys-worker] pushSignal failed", err);
  }
}

function onFatal(err: unknown): void {
  console.error("[genesys-worker] fatal", err);
  process.exitCode = 1;
}

run().catch(onFatal);
