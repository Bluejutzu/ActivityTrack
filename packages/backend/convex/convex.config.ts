import { defineApp } from "convex/server";
import apiTokens from "convex-api-tokens/convex.config";

/**
 * Convex components used by the backend.
 *
 * `apiTokens` (convex-api-tokens) owns the desktop agents' per-device tokens:
 * issued once when an admin approves a device, validated on every ingest /
 * heartbeat, and revoked when the device is disabled. Only the SHA-256 hash is
 * stored — the raw token is shown exactly once at creation (see deviceAuth.ts).
 */
const app = defineApp();
app.use(apiTokens);

export default app;
