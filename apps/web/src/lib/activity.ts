/**
 * Client-side aggregation for the device/person activity views. Turns raw
 * `activitySamples` and `dailyStats` rows into chart-ready series so the detail
 * page can show patterns (trends, time-of-day) instead of a flat list.
 */

export interface Sample {
  capturedAt: number;
  active: boolean;
  idleMs: number;
}

export interface DailyStat {
  day: string; // YYYY-MM-DD
  activeSeconds: number;
  idleSeconds: number;
}

/** One bar per day: active vs idle hours. Fills gaps in [startDay, endDay]. */
export function dailyTrend(
  stats: DailyStat[],
  startDay: string,
  endDay: string,
): Array<{ day: string; label: string; activeHours: number; idleHours: number }> {
  const byDay = new Map(stats.map((s) => [s.day, s]));
  const out: Array<{
    day: string;
    label: string;
    activeHours: number;
    idleHours: number;
  }> = [];
  const cursor = new Date(`${startDay}T00:00:00Z`);
  const end = new Date(`${endDay}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    const s = byDay.get(day);
    out.push({
      day,
      label: `${cursor.getUTCMonth() + 1}/${cursor.getUTCDate()}`,
      activeHours: s ? +(s.activeSeconds / 3600).toFixed(2) : 0,
      idleHours: s ? +(s.idleSeconds / 3600).toFixed(2) : 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * 24 buckets (one per local hour) giving the share of samples that were active.
 * Powers the "when is this person usually active" heatmap strip.
 */
export function hourOfDayActivity(
  samples: Sample[],
): Array<{ hour: number; ratio: number; total: number }> {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    active: 0,
    total: 0,
  }));
  for (const s of samples) {
    const h = new Date(s.capturedAt).getHours();
    buckets[h].total += 1;
    if (s.active) buckets[h].active += 1;
  }
  return buckets.map((b) => ({
    hour: b.hour,
    total: b.total,
    ratio: b.total === 0 ? 0 : b.active / b.total,
  }));
}

/** The six fused employee states, matching the backend `stateSamples.state`. */
export type StateName =
  | "ABSENT"
  | "BREAK"
  | "IN_CALL"
  | "WRAP_UP"
  | "ACTIVE"
  | "IDLE";

export const STATE_NAMES: StateName[] = [
  "ACTIVE",
  "IN_CALL",
  "WRAP_UP",
  "IDLE",
  "BREAK",
  "ABSENT",
];

export interface StateSample {
  state: StateName;
  at: number;
}

export type HourStateBucket = { hour: number } & Record<StateName, number>;

function emptyHourBuckets(): HourStateBucket[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    ACTIVE: 0,
    IN_CALL: 0,
    WRAP_UP: 0,
    IDLE: 0,
    BREAK: 0,
    ABSENT: 0,
  }));
}

/**
 * Minutes spent in each fused state, bucketed by local hour of day, over the
 * window `[windowStart, windowEnd]`. `samples` are on-change state rows (asc by
 * `at`); each one's state holds until the next sample (or `windowEnd` for the
 * last). Intervals are split at hour boundaries so a state spanning multiple
 * hours is credited proportionally. Powers the per-hour timeline breakdown.
 */
export function hourlyStateBreakdown(
  samples: StateSample[],
  windowStart: number,
  windowEnd: number,
): HourStateBucket[] {
  const buckets = emptyHourBuckets();
  if (samples.length === 0 || windowEnd <= windowStart) return buckets;

  for (let i = 0; i < samples.length; i++) {
    const segStart = Math.max(samples[i].at, windowStart);
    const rawEnd = i + 1 < samples.length ? samples[i + 1].at : windowEnd;
    const segEnd = Math.min(rawEnd, windowEnd);
    if (segEnd <= segStart) continue;

    const state = samples[i].state;
    let cur = segStart;
    while (cur < segEnd) {
      const d = new Date(cur);
      const hour = d.getHours();
      d.setMinutes(0, 0, 0);
      const hourEnd = d.getTime() + 3_600_000;
      const chunkEnd = Math.min(hourEnd, segEnd);
      buckets[hour][state] += (chunkEnd - cur) / 60_000;
      cur = chunkEnd;
    }
  }

  // Round for stable rendering/tooltips.
  for (const b of buckets) {
    for (const s of STATE_NAMES) b[s] = +b[s].toFixed(1);
  }
  return buckets;
}

/**
 * Activity through the most recent day, in `slotMinutes` buckets, as the percent
 * of samples that were active. Only buckets covered by samples are returned.
 */
export function intradayTimeline(
  samples: Sample[],
  slotMinutes = 30,
): Array<{ t: number; label: string; activePct: number }> {
  if (samples.length === 0) return [];
  const slotMs = slotMinutes * 60_000;
  const map = new Map<number, { active: number; total: number }>();
  for (const s of samples) {
    const slot = Math.floor(s.capturedAt / slotMs) * slotMs;
    const cur = map.get(slot) ?? { active: 0, total: 0 };
    cur.total += 1;
    if (s.active) cur.active += 1;
    map.set(slot, cur);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({
      t,
      label: new Date(t).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      activePct: Math.round((v.active / v.total) * 100),
    }));
}
