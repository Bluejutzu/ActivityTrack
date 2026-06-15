// NB: intentionally not `server-only` — this module is imported both by the
// server-only Elysia routes AND by the standalone Genesys notifications worker
// (a plain Node process). It only ever reads secrets from process.env, so it
// must never reach a client bundle; its consumers enforce that.
import type {
  GenesysPresence,
  GenesysRoutingStatus,
} from "@activitytrack/shared";

/**
 * Genesys Cloud client — realtime telephony status.
 *
 * Auth is OAuth client-credentials: we exchange clientId/clientSecret for a
 * bearer token (valid ~24h) and cache it in memory until shortly before it
 * expires. Region is configurable; defaults to the German (mypurecloud.de)
 * region used by this deployment.
 *
 * Required OAuth client read permissions: Presence, Routing Status,
 * Conversations, Users.
 */

const REGION = process.env.GENESYS_REGION ?? "mypurecloud.de";
const LOGIN_BASE = `https://login.${REGION}`;
const API_BASE = `https://api.${REGION}`;

interface CachedToken {
  accessToken: string;
  /** Epoch ms after which the token must be refreshed. */
  expiresAt: number;
}
let tokenCache: CachedToken | null = null;

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GENESYS_CLIENT_ID;
  const clientSecret = process.env.GENESYS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GENESYS_CLIENT_ID / GENESYS_CLIENT_SECRET not configured");
  }
  return { clientId, clientSecret };
}

/** Fetch (or reuse a cached) OAuth bearer token. */
export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }
  const { clientId, clientSecret } = credentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${LOGIN_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`Genesys token request failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  // Refresh 60s early to avoid using a token that expires mid-request.
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  return tokenCache.accessToken;
}

async function genesysGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Genesys GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function genesysPost<T>(path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Genesys POST ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Create a notifications channel (the realtime push transport — Genesys has no
 * outbound webhooks). Returns the channel id and the `wss://` connect URI.
 * POST /api/v2/notifications/channels
 */
export async function createNotificationsChannel(): Promise<{
  id: string;
  connectUri: string;
}> {
  return await genesysPost<{ id: string; connectUri: string }>(
    "/api/v2/notifications/channels",
  );
}

/**
 * Subscribe a channel to a set of topics (e.g. v2.users.{id}.routingStatus).
 * POST /api/v2/notifications/channels/{channelId}/subscriptions
 */
export async function subscribeToTopics(
  channelId: string,
  topics: string[],
): Promise<void> {
  await genesysPost(
    `/api/v2/notifications/channels/${channelId}/subscriptions`,
    topics.map((id) => ({ id })),
  );
}

/** Topic ids that carry the state we care about, for one Genesys user. */
export function topicsForUser(genesysUserId: string): string[] {
  return [
    `v2.users.${genesysUserId}.routingStatus`,
    `v2.users.${genesysUserId}.presence`,
    `v2.users.${genesysUserId}.conversations`,
  ];
}

/** GET /api/v2/users/{userId}/routingstatus */
export async function fetchRoutingStatus(
  userId: string,
): Promise<GenesysRoutingStatus | undefined> {
  const body = await genesysGet<{ status?: string }>(
    `/api/v2/users/${userId}/routingstatus`,
  );
  return normalizeRoutingStatus(body.status);
}

/** GET /api/v2/users/{userId}/presences/purecloud */
export async function fetchPresence(userId: string): Promise<{
  presence?: GenesysPresence;
  wrapUp: boolean;
}> {
  const body = await genesysGet<{
    presenceDefinition?: { systemPresence?: string };
  }>(`/api/v2/users/${userId}/presences/purecloud`);
  const system = body.presenceDefinition?.systemPresence;
  return {
    presence: normalizePresence(system),
    wrapUp: isWrapUpPresence(system),
  };
}

export function normalizeRoutingStatus(
  raw: string | undefined,
): GenesysRoutingStatus | undefined {
  switch (raw?.toUpperCase()) {
    case "IDLE":
      return "IDLE";
    case "INTERACTING":
      return "INTERACTING";
    case "OFF_QUEUE":
      return "OFF_QUEUE";
    case "NOT_RESPONDING":
      return "NOT_RESPONDING";
    default:
      return undefined;
  }
}

/**
 * Genesys `systemPresence` is a richer enum than our four-value model; collapse
 * the long tail (Meeting, Training, Break, Meal, …) onto the nearest bucket.
 */
export function normalizePresence(
  raw: string | undefined,
): GenesysPresence | undefined {
  switch (raw?.toUpperCase()) {
    case "AVAILABLE":
    case "ON QUEUE":
    case "ON_QUEUE":
      return "AVAILABLE";
    case "BUSY":
    case "MEETING":
    case "MEAL":
    case "TRAINING":
      return "BUSY";
    case "AWAY":
    case "IDLE":
    case "BREAK":
    case "OUT OF OFFICE":
    case "OUT_OF_OFFICE":
      return "AWAY";
    case "OFFLINE":
      return "OFFLINE";
    default:
      return undefined;
  }
}

/** After-call work surfaces as a dedicated system presence in Genesys. */
function isWrapUpPresence(raw: string | undefined): boolean {
  const v = raw?.toUpperCase();
  return v === "WRAP UP" || v === "WRAP-UP" || v === "WRAPUP";
}

/** A normalized slice of telephony state extracted from a notification event. */
export interface ParsedGenesysEvent {
  genesysUserId: string;
  routingStatus?: GenesysRoutingStatus;
  presence?: GenesysPresence;
  wrapUp?: boolean;
}

/**
 * Map a raw notifications WebSocket message to a normalized event, or null if
 * it's a heartbeat / unrelated topic. Topic id shape: `v2.users.{id}.{kind}`.
 */
export function parseNotificationEvent(
  raw: unknown,
): ParsedGenesysEvent | null {
  const msg = raw as { topicName?: string; eventBody?: unknown };
  const topic = msg?.topicName;
  if (!topic) return null;

  const m = /^v2\.users\.([^.]+)\.(routingStatus|presence|conversations)$/.exec(
    topic,
  );
  if (!m) return null;
  const genesysUserId = m[1]!;
  const kind = m[2]!;
  const eventBody = msg.eventBody as Record<string, unknown> | undefined;
  if (!eventBody) return null;

  if (kind === "routingStatus") {
    const status = (eventBody.routingStatus as { status?: string } | undefined)
      ?.status;
    return { genesysUserId, routingStatus: normalizeRoutingStatus(status) };
  }

  if (kind === "presence") {
    const system = (
      eventBody.presenceDefinition as { systemPresence?: string } | undefined
    )?.systemPresence;
    return {
      genesysUserId,
      presence: normalizePresence(system),
      wrapUp: isWrapUpPresence(system),
    };
  }

  // conversations: flag after-call work when any participant is in wrap-up.
  const participants = (
    eventBody.participants as Array<{ wrapupRequired?: boolean; state?: string }>
    | undefined
  ) ?? [];
  const inWrapUp = participants.some(
    (p) => p.state?.toLowerCase() === "wrapup" || p.wrapupRequired === true,
  );
  return { genesysUserId, wrapUp: inWrapUp };
}
