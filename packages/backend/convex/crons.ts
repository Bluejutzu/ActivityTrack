import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled maintenance. Retention prune runs daily; because pruneOldSamples
 * deletes in bounded batches, a large backlog is cleared over successive runs.
 */
const crons = cronJobs();

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
