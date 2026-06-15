// NB: intentionally not `server-only` — this module is imported by the optional
// standalone Genesys notifications worker (a plain Node process) as well as any
// server code. It only reads secrets from process.env, so it must never reach a
// client bundle; its consumers enforce that.
//
// Per-user polling + status normalization now live in the Convex backend
// (`convex/integrations.ts`) so they run on the Convex cron. What remains here
// is only what the realtime WebSocket worker needs: OAuth + channel setup.

const REGION = process.env.GENESYS_REGION ?? "mypurecloud.de";
const LOGIN_BASE = `https://login.${REGION}`;
const API_BASE = `https://api.${REGION}`;

interface CachedToken {
  accessToken: string;
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

/** Fetch (or reuse a cached) OAuth bearer token (client-credentials grant). */
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
  if (!res.ok) throw new Error(`Genesys token request failed: ${res.status}`);
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  return tokenCache.accessToken;
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
  if (!res.ok) throw new Error(`Genesys POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Create a notifications channel (the realtime push transport — Genesys has no
 * outbound webhooks). Returns the channel id and the `wss://` connect URI.
 */
export async function createNotificationsChannel(): Promise<{
  id: string;
  connectUri: string;
}> {
  return await genesysPost<{ id: string; connectUri: string }>(
    "/api/v2/notifications/channels",
  );
}

/** Subscribe a channel to a set of topics (e.g. v2.users.{id}.routingStatus). */
export async function subscribeToTopics(
  channelId: string,
  topics: string[],
): Promise<void> {
  await genesysPost(
    `/api/v2/notifications/channels/${channelId}/subscriptions`,
    topics.map((id) => ({ id })),
  );
}
