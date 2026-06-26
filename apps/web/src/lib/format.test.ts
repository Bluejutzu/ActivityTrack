import { describe, it, expect } from "vitest";
import { localDay, todayLocalDay, formatDuration } from "./format";

describe("localDay", () => {
  it("returns the UTC date at offset 0", () => {
    expect(localDay(Date.UTC(2026, 5, 26, 12, 0), 0)).toBe("2026-06-26");
  });

  it("rolls forward into the next local day for UTC+2 (Berlin, offset -120)", () => {
    // 22:30 UTC = 00:30 the next day in Berlin summer time.
    expect(localDay(Date.UTC(2026, 5, 26, 22, 30), -120)).toBe("2026-06-27");
  });

  it("keeps an early-morning UTC instant on the same Berlin day", () => {
    // 06:30 UTC = 08:30 Berlin, still the 26th.
    expect(localDay(Date.UTC(2026, 5, 26, 6, 30), -120)).toBe("2026-06-26");
  });

  it("rolls back into the previous local day for UTC-5 (offset +300)", () => {
    // 03:00 UTC = 22:00 the previous day at UTC-5.
    expect(localDay(Date.UTC(2026, 5, 26, 3, 0), 300)).toBe("2026-06-25");
  });
});

describe("todayLocalDay", () => {
  it("matches localDay(now, browser offset)", () => {
    const now = Date.now();
    expect(todayLocalDay()).toBe(localDay(now, new Date().getTimezoneOffset()));
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes (en)", () => {
    expect(formatDuration(3 * 3600 + 42 * 60, "en")).toBe("3 h 42 m");
  });

  it("formats hours and minutes (de)", () => {
    expect(formatDuration(3 * 3600 + 42 * 60, "de")).toBe("3 Std. 42 Min.");
  });

  it("drops hours when under an hour", () => {
    expect(formatDuration(150, "en")).toBe("2 m"); // 2m30s floors to 2m
  });

  it("shows seconds when under a minute", () => {
    expect(formatDuration(45, "en")).toBe("45 s");
  });

  it("clamps negatives to zero", () => {
    expect(formatDuration(-10, "en")).toBe("0 s");
  });
});
