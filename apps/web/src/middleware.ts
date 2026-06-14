import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk middleware runs on every dashboard request so Clerk's auth context is
 * available. Route protection itself is handled in the (dash) layout (which
 * renders the sign-in screen when unauthenticated) and enforced server-side by
 * Convex RBAC — this just wires Clerk into the request lifecycle.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
