/**
 * Minimal ambient typing for `process.env`, which the Convex runtime exposes
 * for reading deployment environment variables (e.g. ACTIVITYTRACK_SIGNAL_SECRET,
 * API_TOKENS_ENCRYPTION_KEY, CONVEX_SITE_URL). We deliberately do NOT pull in
 * full @types/node — the
 * Convex runtime is not Node, and only `process.env` is available.
 */
declare const process: {
  env: Record<string, string | undefined>;
};
