import { describe, it, expect } from "vitest";
import {
  dailyTrend,
  hourOfDayActivity,
  hourlyStateBreakdown,
  intradayTimeline,
  timelineCharts,
  lastActiveDay,
  dayStateSegments,
  minuteStates,
  isWorkingState,
  sumDaily,
  weekStartOf,
  weeklyTrend,
  type Sample,
  type StateSample,
} from "./activity";

// Berlin summer (CEST = UTC+2): Date.prototype.getTimezoneOffset() returns -120.
const BERLIN = -120;
/** Epoch ms for a Berlin-summer wall-clock time (UTC = local − 2h). */
const berlin = (y: number, mo: number, d: number, h: number, mi = 0) =>
  Date.UTC(y, mo, d, h - 2, mi);
const sample = (capturedAt: number, active: boolean): Sample => ({
  capturedAt,
  active,
  idleMs: active ? 0 : 600_000,
});

describe("hourOfDayActivity", () => {
  it("buckets samples into the local hour and computes the active ratio", () => {
    const data = hourOfDayActivity(
      [
        sample(berlin(2026, 5, 26, 8, 30), true),
        sample(berlin(2026, 5, 26, 8, 45), false),
      ],
      BERLIN,
    );
    expect(data).toHaveLength(24);
    expect(data[8]).toEqual({ hour: 8, total: 2, ratio: 0.5 });
    expect(data[7].total).toBe(0);
    expect(data[9].total).toBe(0);
  });

  it("uses the local hour, not UTC, across the offset", () => {
    // 23:30 Berlin = 21:30 UTC — must land in hour 23, not 21.
    const data = hourOfDayActivity(
      [sample(berlin(2026, 5, 26, 23, 30), true)],
      BERLIN,
    );
    expect(data[23].total).toBe(1);
    expect(data[21].total).toBe(0);
  });
});

describe("hourlyStateBreakdown", () => {
  const win = (fromH: number, toH: number) =>
    [berlin(2026, 5, 26, fromH), berlin(2026, 5, 26, toH)] as const;

  it("splits a state that spans an hour boundary (the frame-of-reference fix)", () => {
    const [ws, we] = win(8, 10);
    const out = hourlyStateBreakdown(
      [{ state: "ACTIVE", at: berlin(2026, 5, 26, 8, 30) }],
      ws,
      we,
      BERLIN,
    );
    // 08:30→10:00 must be 30 min in hour 8 and 60 min in hour 9 — NOT 90/0.
    expect(out[8].ACTIVE).toBe(30);
    expect(out[9].ACTIVE).toBe(60);
  });

  it("splits a multi-hour span proportionally", () => {
    const out = hourlyStateBreakdown(
      [{ state: "IDLE", at: berlin(2026, 5, 26, 8, 0) }],
      berlin(2026, 5, 26, 8),
      berlin(2026, 5, 26, 11, 15),
      BERLIN,
    );
    expect([out[8].IDLE, out[9].IDLE, out[10].IDLE, out[11].IDLE]).toEqual([
      60, 60, 60, 15,
    ]);
  });

  it("credits each state within an hour to the right bucket", () => {
    const [ws, we] = win(8, 9);
    const out = hourlyStateBreakdown(
      [
        { state: "ACTIVE", at: berlin(2026, 5, 26, 8, 0) },
        { state: "IDLE", at: berlin(2026, 5, 26, 8, 40) },
      ],
      ws,
      we,
      BERLIN,
    );
    expect(out[8].ACTIVE).toBe(40);
    expect(out[8].IDLE).toBe(20);
    expect(out[9].ACTIVE).toBe(0);
  });

  it("returns all-zero buckets for empty input or an inverted window", () => {
    const empty = hourlyStateBreakdown([], 0, 1000, BERLIN);
    expect(empty).toHaveLength(24);
    expect(empty.every((b) => b.ACTIVE === 0 && b.IDLE === 0)).toBe(true);
    const inverted = hourlyStateBreakdown(
      [{ state: "ACTIVE", at: 0 }],
      1000,
      0,
      BERLIN,
    );
    expect(inverted.every((b) => b.ACTIVE === 0)).toBe(true);
  });
});

describe("intradayTimeline", () => {
  it("buckets by slot and reports percent active", () => {
    const out = intradayTimeline(
      [
        sample(berlin(2026, 5, 26, 8, 15), true),
        sample(berlin(2026, 5, 26, 8, 45), false),
      ],
      30,
    );
    expect(out.map((d) => d.activePct)).toEqual([100, 0]);
  });

  it("is empty for no samples", () => {
    expect(intradayTimeline([], 30)).toEqual([]);
  });
});

describe("timelineCharts (current-day scoping)", () => {
  it("includes only samples whose LOCAL day matches the selected day", () => {
    const samples: Sample[] = [
      sample(berlin(2026, 5, 26, 8, 15), true), // 26th
      sample(berlin(2026, 5, 26, 8, 45), false), // 26th
      sample(berlin(2026, 5, 27, 0, 30), true), // 27th — excluded
    ];
    const { heatmap, intraday } = timelineCharts(samples, "2026-06-26", BERLIN);
    expect(heatmap[8].total).toBe(2);
    expect(heatmap[8].ratio).toBe(0.5);
    expect(heatmap[0].total).toBe(0); // the 27th 00:30 sample must not leak in
    expect(intraday).toHaveLength(2);
  });

  it("is empty for a day with no data (stale device shows nothing for today)", () => {
    const stale: Sample[] = [
      sample(berlin(2026, 5, 21, 14, 0), true),
      sample(berlin(2026, 5, 21, 15, 0), false),
    ];
    const { heatmap, intraday } = timelineCharts(stale, "2026-06-26", BERLIN);
    expect(intraday).toEqual([]);
    expect(heatmap.every((b) => b.total === 0)).toBe(true);
  });
});

describe("lastActiveDay", () => {
  it("returns the newest sample's local day (samples are desc)", () => {
    const samples: Sample[] = [
      sample(berlin(2026, 5, 21, 17, 0), true), // newest
      sample(berlin(2026, 5, 20, 9, 0), false),
    ];
    expect(lastActiveDay(samples, BERLIN)).toBe("2026-06-21");
  });

  it("returns null when there are no samples", () => {
    expect(lastActiveDay([], BERLIN)).toBeNull();
  });
});

describe("dailyTrend", () => {
  it("fills the [start,end] range and converts seconds to hours", () => {
    const out = dailyTrend(
      [{ day: "2026-06-25", activeSeconds: 3600, idleSeconds: 1800 }],
      "2026-06-24",
      "2026-06-26",
    );
    expect(out.map((d) => d.day)).toEqual([
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
    ]);
    expect(out[0]).toMatchObject({ activeHours: 0, idleHours: 0, label: "6/24" });
    expect(out[1]).toMatchObject({ activeHours: 1, idleHours: 0.5 });
  });
});

describe("dayStateSegments", () => {
  const dayStart = Date.UTC(2026, 5, 26, 0, 0);
  const dayEnd = dayStart + 86_400_000;
  const H = 3_600_000;

  it("clamps a prior-day row to the day start", () => {
    const segs = dayStateSegments(
      [
        { state: "ACTIVE", at: dayStart - H }, // started yesterday
        { state: "IDLE", at: dayStart + H },
      ],
      dayStart,
      dayEnd,
    );
    expect(segs[0]).toEqual({ state: "ACTIVE", start: dayStart, end: dayStart + H });
    expect(segs[1]).toEqual({ state: "IDLE", start: dayStart + H, end: dayEnd });
  });

  it("merges touching runs of the same state", () => {
    const segs = dayStateSegments(
      [
        { state: "ACTIVE", at: dayStart },
        { state: "ACTIVE", at: dayStart + H },
      ],
      dayStart,
      dayEnd,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ state: "ACTIVE", start: dayStart, end: dayEnd });
  });

  it("clamps the final run to the day end", () => {
    const segs = dayStateSegments(
      [{ state: "ACTIVE", at: dayStart }],
      dayStart,
      dayEnd,
    );
    expect(segs[0].end).toBe(dayEnd);
  });
});

describe("minuteStates", () => {
  it("produces a dense per-minute array with nulls before the first state", () => {
    const dayStart = 0;
    const dayEnd = 10 * 60_000; // 10-minute window
    const out = minuteStates(
      [{ state: "ACTIVE", at: 2 * 60_000 }],
      dayStart,
      dayEnd,
    );
    expect(out).toHaveLength(10);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBe("ACTIVE");
    expect(out[9]).toBe("ACTIVE");
  });

  it("leaves minutes past a short window unrepresented (length follows window)", () => {
    // A window capped at 'now' (5 min) yields only 5 slots — later minutes of
    // the day simply don't exist in the array, so the grid renders them empty.
    const out = minuteStates([{ state: "IDLE", at: 0 }], 0, 5 * 60_000);
    expect(out).toHaveLength(5);
    expect(out.every((s) => s === "IDLE")).toBe(true);
  });
});

describe("isWorkingState", () => {
  it("treats ACTIVE/IN_CALL/WRAP_UP as working", () => {
    expect(isWorkingState("ACTIVE", false)).toBe(true);
    expect(isWorkingState("IN_CALL", false)).toBe(true);
    expect(isWorkingState("WRAP_UP", false)).toBe(true);
  });
  it("treats BREAK/ABSENT/IDLE as not working", () => {
    expect(isWorkingState("BREAK", true)).toBe(false);
    expect(isWorkingState("ABSENT", true)).toBe(false);
    expect(isWorkingState("IDLE", true)).toBe(false);
  });
  it("falls back to the raw active flag when no fused state exists", () => {
    expect(isWorkingState(null, true)).toBe(true);
    expect(isWorkingState(null, false)).toBe(false);
  });
});

describe("rollups", () => {
  it("sumDaily totals active and idle seconds", () => {
    expect(
      sumDaily([
        { day: "a", activeSeconds: 100, idleSeconds: 50 },
        { day: "b", activeSeconds: 200, idleSeconds: 0 },
      ]),
    ).toEqual({ activeSeconds: 300, idleSeconds: 50 });
  });

  it("weekStartOf returns the ISO Monday and is idempotent", () => {
    expect(weekStartOf("2026-06-26")).toBe("2026-06-22"); // Fri → Mon
    expect(weekStartOf("2026-06-22")).toBe("2026-06-22"); // Mon → Mon
  });

  it("weeklyTrend groups daily rows into ISO weeks", () => {
    const out = weeklyTrend(
      [
        { day: "2026-06-22", activeSeconds: 3600, idleSeconds: 0 },
        { day: "2026-06-24", activeSeconds: 1800, idleSeconds: 1800 },
      ],
      "2026-06-22",
      "2026-06-28",
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      weekStart: "2026-06-22",
      activeHours: 1.5,
      idleHours: 0.5,
    });
  });
});

// Keep the StateSample import referenced for type-checking of fixtures above.
const _typecheck: StateSample = { state: "ACTIVE", at: 0 };
void _typecheck;
