import { ConvexError } from "convex/values";

/**
 * Structured application errors. Convex redacts plain `throw new Error(msg)`
 * messages in production (the client only sees "Server Error"), which would
 * leave the dashboard unable to tell the user *what* went wrong. Throwing a
 * `ConvexError` with structured data instead propagates `{ code, message }` to
 * the client untouched, so the UI can map `code` to a localized, human-readable
 * message (and fall back to `message` for anything it doesn't recognize).
 *
 * `code` is a stable machine string (e.g. "auth.forbidden", "notFound.device").
 * `message` is an English technical fallback — never user-facing on its own.
 */
export function appError(code: string, message: string): ConvexError<{
  code: string;
  message: string;
}> {
  return new ConvexError({ code, message });
}
