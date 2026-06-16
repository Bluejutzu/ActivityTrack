"use node";

import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import { signalSecret } from "./integrationsShared";
import { pollGenesys } from "./genesys";
import { pollClockodo } from "./clockodo";

/**
 * Scheduled poll orchestrator. The per-source HTTP clients live in `genesys.ts`
 * and `clockodo.ts`; this file just wires them together for the Convex cron.
 *
 * Polling lives in Convex — not on a Vercel Cron — because Convex crons run on
 * the free tier and can fire every minute (Vercel Hobby crons are once-a-day).
 * Secrets come from the Convex deployment env. Each source is isolated (its
 * `poll*` helper try/catches and reports health), so one integration being down
 * never affects the other or the fused state.
 */

/** Scheduled by Convex cron. Polls every configured source for all people. */
export const pollAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const secret = signalSecret();
    const mappings = await ctx.runQuery(api.state.mappings, { secret });
    await pollGenesys(ctx, mappings);
    await pollClockodo(ctx, secret, mappings);
  },
});
