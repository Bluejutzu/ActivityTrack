/**
 * Convex Auth provider config. The CONVEX_SITE_URL env var is set automatically
 * by Convex; @convex-dev/auth uses it to issue/verify its own JWTs. No external
 * identity provider is configured (password auth lives entirely in Convex).
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
