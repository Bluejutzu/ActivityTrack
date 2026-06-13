import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { ingestPayloadSchema } from "@activitytrack/shared";

/**
 * The agent's only entry point. This is where ALL validation lives — the
 * desktop app is a dumb sender by design.
 *
 * Checks performed here (implement during build-out):
 *   1. Bearer token == ACTIVITYTRACK_INGEST_KEY env var (reject otherwise).
 *   2. zod schema validation via ingestPayloadSchema (reject malformed).
 *   3. Clock-skew sanity: drop samples whose capturedAt is wildly off now().
 *   4. Auto-register unknown deviceIds as `pending`; ignore samples from
 *      `disabled` devices.
 *   5. Insert samples + update device.lastSeen; rollups run in a mutation.
 */
const http = httpRouter();

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.ACTIVITYTRACK_INGEST_KEY;
    const auth = request.headers.get("authorization");
    if (!expected || auth !== `Bearer ${expected}`) {
      return new Response("unauthorized", { status: 401 });
    }

    const parsed = ingestPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return new Response("bad request", { status: 400 });
    }

    // TODO: call an internal mutation to persist samples + update devices.
    // await ctx.runMutation(internal.ingest.recordSamples, parsed.data);
    void ctx;
    return new Response("ok", { status: 200 });
  }),
});

export default http;
