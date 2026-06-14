/**
 * Convex auth provider config. Identity is owned by Clerk; Convex verifies the
 * Clerk-issued JWT. `domain` is the Clerk instance's Frontend API / issuer URL
 * (e.g. https://your-app.clerk.accounts.dev), supplied via CLERK_JWT_ISSUER_DOMAIN
 * as a Convex deployment env var. `applicationID` must match the Clerk JWT
 * template name — create a template called "convex" in the Clerk dashboard.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
