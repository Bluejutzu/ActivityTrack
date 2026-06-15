import { app } from "@/server/api";

/**
 * Mount the ElysiaJS app into the Next.js App Router. Elysia exposes a standard
 * fetch handler; we delegate every method on the catch-all `/api/*` route to it.
 * (Convex reactive reads do NOT pass through here — they use the Convex client.)
 */
export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const PATCH = app.handle;
export const DELETE = app.handle;

// These endpoints push live signals; never cache.
export const dynamic = "force-dynamic";
