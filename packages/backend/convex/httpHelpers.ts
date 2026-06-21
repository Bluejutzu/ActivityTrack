/**
 * Shared helpers for the agent-facing HTTP endpoints (see http.ts). Each
 * endpoint used to re-implement bearer parsing and response shaping inline;
 * these factor that out so every ingress point reads the same way and there's
 * one place to change the auth/response conventions.
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
