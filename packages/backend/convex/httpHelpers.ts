import { safeEqual } from "./crypto";

/**
 * Shared helpers for the agent-facing HTTP endpoints (see http.ts). Each
 * endpoint used to re-implement bearer parsing, the bootstrap-key check, and
 * response shaping inline; these factor that out so every ingress point reads
 * the same way and there's one place to change the auth/response conventions.
 */

/** The Bearer token from an Authorization header, or null. */
export function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export const unauthorized = (): Response =>
  new Response("unauthorized", { status: 401 });

export const badRequest = (): Response =>
  new Response("bad request", { status: 400 });

/** A JSON response with the standard content-type header. */
export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Parse a JSON body, returning `undefined` (not throwing) on malformed input. */
export async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/**
 * Validate the shared bootstrap key (ACTIVITYTRACK_INGEST_KEY) with a
 * constant-time compare. Used by the pre-enrollment endpoints (/agent/register,
 * /agent/verify-password) that authenticate with the bootstrap key rather than a
 * per-device key.
 */
export function bootstrapKeyValid(request: Request): boolean {
  const expected = process.env.ACTIVITYTRACK_INGEST_KEY;
  if (!expected) return false;
  return safeEqual(bearerToken(request) ?? "", expected);
}
