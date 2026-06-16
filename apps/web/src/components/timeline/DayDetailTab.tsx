"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import {
  dayStateSegments,
  minuteStates,
  STATE_NAMES,
  type StateName,
} from "@/lib/activity";
import { STATE_COLOR } from "@/components/charts/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const DAY_MS = 86_400_000;

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "Day in detail": a horizontal colour-coded state strip plus a per-minute grid
 * (24 rows × 60 cells) for one chosen day. Hover any block/cell to read the exact
 * state and time. Owns its date selection and fetches that day's state history.
 */
export function DayDetailTab({
  employeeId,
  today,
}: {
  employeeId: string | null;
  today: string;
}) {
  const { t } = useI18n();
  const [day, setDay] = useState(today);

  // Local midnight → next midnight for the selected day.
  const dayStart = useMemo(() => new Date(`${day}T00:00:00`).getTime(), [day]);
  const dayEnd = dayStart + DAY_MS;

  const history = useQuery(
    api.state.history,
    employeeId ? { employeeId, since: dayStart, until: dayEnd } : "skip",
  );

  const { segments, minutes } = useMemo(() => {
    const rows = history ?? [];
    return {
      segments: dayStateSegments(rows, dayStart, dayEnd),
      minutes: minuteStates(rows, dayStart, dayEnd),
    };
  }, [history, dayStart, dayEnd]);

  const stateLabel = (s: StateName) => t(`empstate.${s}`);
  // Mark "now" on the strip when viewing today.
  const nowPct =
    day === today ? ((Date.now() - dayStart) / DAY_MS) * 100 : null;

  return (
    <Card className="animate-fade-up">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {t("timeline.day.heading")}
            </CardTitle>
            <p className="text-sm text-muted">{t("timeline.day.sub")}</p>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t("timeline.day.date")}
            <Input
              type="date"
              value={day}
              max={today}
              onChange={(e) => setDay(e.target.value || today)}
              className="w-40"
            />
          </label>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {STATE_NAMES.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1.5 text-[11px] text-muted"
            >
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ background: STATE_COLOR[s] }}
              />
              {stateLabel(s)}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {!employeeId ? (
          <p className="py-8 text-center text-sm text-muted">
            {t("timeline.hourly.unlinked")}
          </p>
        ) : history === undefined ? (
          <Skeleton className="h-72 w-full" />
        ) : segments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {t("timeline.day.empty")}
          </p>
        ) : (
          <div className="space-y-5">
            {/* ── Horizontal day strip ── */}
            <div>
              <div className="relative h-7 w-full overflow-hidden rounded-md border border-border bg-panel-2">
                {segments.map((seg, i) => {
                  const left = ((seg.start - dayStart) / DAY_MS) * 100;
                  const width = ((seg.end - seg.start) / DAY_MS) * 100;
                  return (
                    <div
                      key={i}
                      className="absolute inset-y-0"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: STATE_COLOR[seg.state],
                      }}
                      title={`${hhmm(seg.start)}–${hhmm(seg.end)} · ${stateLabel(seg.state)}`}
                    />
                  );
                })}
                {nowPct != null && nowPct >= 0 && nowPct <= 100 && (
                  <div
                    className="absolute inset-y-0 w-px bg-fg"
                    style={{ left: `${nowPct}%` }}
                    title={t("timeline.day.now")}
                  />
                )}
              </div>
              {/* Hour ticks: 00, 06, 12, 18, 24 */}
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
                {[0, 6, 12, 18, 24].map((h) => (
                  <span key={h}>{String(h).padStart(2, "0")}</span>
                ))}
              </div>
            </div>

            {/* ── Per-minute grid (24 rows × 60 minutes) ── */}
            <div className="space-y-0.5">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-right font-mono text-[10px] text-muted">
                    {String(h).padStart(2, "0")}
                  </span>
                  <div className="flex flex-1 gap-px">
                    {Array.from({ length: 60 }, (_, m) => {
                      const idx = h * 60 + m;
                      const st = minutes[idx] ?? null;
                      return (
                        <span
                          key={m}
                          className="h-3 flex-1 rounded-[1px]"
                          style={{
                            background: st ? STATE_COLOR[st] : "#F1F3F6",
                          }}
                          title={
                            st
                              ? `${hhmm(dayStart + idx * 60_000)} · ${stateLabel(st)}`
                              : hhmm(dayStart + idx * 60_000)
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
