import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled maintenance. Retention prune runs daily; because pruneOldSamples
 * deletes in bounded batches, a large backlog is cleared over successive runs.
 */
const crons = cronJobs();

/**
 * Poll Genesys + Clockodo and fold the results into the fused employee state.
 * Convex crons run on the free tier and can fire frequently (unlike Vercel
 * Hobby crons, which are once-a-day). Scheduled to business hours on weekdays
 * (UTC) — Clockodo clock-ins still arrive via webhook outside this window, and
 * nobody is on shift at night/weekends. Adjust to your team's hours/timezone.
 */
crons.cron(
  "poll integrations",
  "*/2 5-18 * * 1-5",
  internal.integrations.pollAll,
  {},
);

crons.daily(
  "prune old raw samples",
  { hourUTC: 3, minuteUTC: 0 },
  internal.maintenance.pruneOldSamples,
  {},
);

crons.daily(
  "prune old resolved events",
  { hourUTC: 3, minuteUTC: 30 },
  internal.events.purgeOldEvents,
  {},
);

export default crons;
