"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useConvex } from "convex/react";
import { ArrowLeft, Clock, Coffee, Download, Radio } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import type { EmployeeState } from "@activitytrack/shared";
import { useI18n } from "@/lib/i18n";
import {
  formatDuration,
  formatRelativeTime,
  formatTime,
  localDay,
  todayLocalDay,
} from "@/lib/format";
import {
  dailyTrend,
  hourOfDayActivity,
  hourlyStateBreakdown,
  intradayTimeline,
  STATE_NAMES,
  type Sample,
  type StateName,
} from "@/lib/activity";
import { downloadFile, toCsv, toJson } from "@/lib/export";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyTrendChart } from "@/components/charts/DailyTrendChart";
import { IntradayChart } from "@/components/charts/IntradayChart";
import { HourHeatmap } from "@/components/charts/HourHeatmap";
import { HourlyStateChart } from "@/components/charts/HourlyStateChart";
import { StateBadge, SourceSignals } from "@/components/state/StateBits";

const TREND_DAYS = 14;

function KpiCard({
  icon,
  label,
  value,
  tone = "fg",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "fg" | "ok" | "warn" | "accent";
}) {
  const toneClass = {
    fg: "text-fg",
    ok: "text-ok",
    warn: "text-warn",
    accent: "text-accent",
  }[tone];
  return (
    <Card className="animate-fade-up">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-panel-2 text-muted">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="kicker truncate">{label}</p>
          <p
            className={`mt-1 truncate font-display text-xl font-semibold tabular-nums ${toneClass}`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TimelinePage({
  params,
}: {
  params: { deviceId: string };
}) {
  const { t, lang } = useI18n();
  const convex = useConvex();
  const deviceId = decodeURIComponent(params.deviceId);

  const samples = useQuery(api.stats.recentSamples, { deviceId, limit: 1000 });
  const today = todayLocalDay();
  const startDay = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (TREND_DAYS - 1));
    return d.toISOString().slice(0, 10);
  }, [today]);
  const daily = useQuery(api.stats.dailyRange, {
    deviceId,
    startDay,
    endDay: today,
  });
  const team = useQuery(api.stats.teamOverview);

  const device = team?.find((d) => d.deviceId === deviceId) ?? null;
  const todayStats = daily?.find((d) => d.day === today);
  const employeeId = device?.personEmployeeId ?? null;

  // Fused state for the linked employee + today's state-change history.
  const liveState = useQuery(
    api.state.get,
    employeeId ? { employeeId } : "skip",
  );
  const dayStartMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [today]);
  const stateHistory = useQuery(
    api.state.history,
    employeeId ? { employeeId, since: dayStartMs } : "skip",
  );

  // Aggregations (memoised; samples can be up to 1000 rows).
  const { trend, heatmap, intraday, hourlyStates } = useMemo(() => {
    const s: Sample[] = samples ?? [];
    const newestDay =
      s.length > 0 ? localDay(s[0].capturedAt, new Date().getTimezoneOffset()) : today;
    const sameDay = s.filter(
      (x) => localDay(x.capturedAt, new Date().getTimezoneOffset()) === newestDay,
    );
    return {
      trend: dailyTrend(daily ?? [], startDay, today),
      heatmap: hourOfDayActivity(s),
      intraday: intradayTimeline(sameDay, 30),
      hourlyStates: hourlyStateBreakdown(
        stateHistory ?? [],
        dayStartMs,
        Date.now(),
      ),
    };
  }, [samples, daily, startDay, today, stateHistory, dayStartMs]);

  // Localised state labels for the hourly chart legend/tooltip.
  const stateLabels = useMemo(
    () =>
      Object.fromEntries(
        STATE_NAMES.map((s) => [s, t(`empstate.${s}`)]),
      ) as Record<StateName, string>,
    [t],
  );

  // ── Per-employee export (JSON / CSV over a date range) ──────────────────
  const [exportStart, setExportStart] = useState(startDay);
  const [exportEnd, setExportEnd] = useState(today);
  const [exporting, setExporting] = useState(false);

  async function runExport(format: "json" | "csv") {
    setExporting(true);
    try {
      const data = await convex.query(api.stats.exportDevice, {
        deviceId,
        startDay: exportStart,
        endDay: exportEnd,
      });
      const base = `${device?.personName ?? device?.hostname ?? deviceId}_${exportStart}_${exportEnd}`.replace(
        /[^\w.-]+/g,
        "-",
      );
      if (format === "json") {
        downloadFile(`${base}.json`, "application/json", toJson(data));
      } else {
        const rows = data.samples.map((s) => ({
          capturedAt: new Date(s.capturedAt).toISOString(),
          active: s.active,
          idleMs: s.idleMs,
          windowsUser: s.windowsUser,
          hostname: s.hostname,
        }));
        const csv = toCsv(rows, [
          "capturedAt",
          "active",
          "idleMs",
          "windowsUser",
          "hostname",
        ]);
        downloadFile(`${base}.csv`, "text/csv;charset=utf-8", csv);
      }
    } finally {
      setExporting(false);
    }
  }

  if (samples === undefined) {
    return (
      <section className="space-y-5">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </section>
    );
  }

  const title = device?.personName ?? device?.hostname ?? deviceId;

  return (
    <section className="space-y-5">
      <Link
        href="/"
        className="group inline-flex items-center gap-1 text-sm text-accent"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
        {t("timeline.back")}
      </Link>

      <div>
        <p className="kicker mb-1.5">// Device telemetry</p>
        <h1 className="font-display text-2xl font-semibold tracking-tightest text-fg">
          {title}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted">{deviceId}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label={t("timeline.kpi.activeToday")}
          tone="ok"
          value={formatDuration(todayStats?.activeSeconds ?? 0, lang)}
        />
        <KpiCard
          icon={<Coffee className="h-4 w-4" />}
          label={t("timeline.kpi.idleToday")}
          tone="warn"
          value={formatDuration(todayStats?.idleSeconds ?? 0, lang)}
        />
        <KpiCard
          icon={<Radio className="h-4 w-4" />}
          label={t("timeline.kpi.status")}
          value={
            <Badge variant={device?.online ? "ok" : "muted"}>
              {device?.online ? t("timeline.online") : t("timeline.offline")}
            </Badge>
          }
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label={t("timeline.kpi.lastSeen")}
          value={device ? formatRelativeTime(device.lastSeen, lang) : "—"}
        />
      </div>

      {/* Current fused state (workstation + Genesys + Clockodo) */}
      {employeeId && (
        <Card className="animate-fade-up">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">{t("timeline.state.heading")}</CardTitle>
            {liveState && <StateBadge state={liveState.finalState as EmployeeState} />}
          </CardHeader>
          <CardContent>
            {liveState === undefined ? (
              <Skeleton className="h-20 w-full" />
            ) : liveState === null ? (
              <p className="py-4 text-center text-sm text-muted">
                {t("timeline.state.empty")}
              </p>
            ) : (
              <>
                {liveState.deviceIdle && liveState.idleSeconds != null && (
                  <p className="mb-1 text-xs text-muted">
                    {t("state.idleFor", {
                      duration: formatDuration(liveState.idleSeconds, lang),
                    })}
                  </p>
                )}
                <SourceSignals
                  deviceIdle={liveState.deviceIdle ?? null}
                  genesysRoutingStatus={liveState.genesysRoutingStatus ?? null}
                  genesysPresence={liveState.genesysPresence ?? null}
                  clockodoWorking={liveState.clockodoWorking ?? null}
                  clockodoBreak={liveState.clockodoBreak ?? null}
                  clockodoAbsent={liveState.clockodoAbsent ?? null}
                />
                <p className="mt-3 border-t border-border-soft pt-2.5 font-mono text-[11px] text-muted">
                  {t("state.updated")}{" "}
                  <span className="text-fg/80">
                    {formatRelativeTime(liveState.updatedAt, lang)}
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">{t("timeline.tabs.charts")}</TabsTrigger>
          <TabsTrigger value="raw">{t("timeline.tabs.raw")}</TabsTrigger>
          <TabsTrigger value="export">{t("timeline.tabs.export")}</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="animate-fade-up">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("timeline.trend.heading")}
                </CardTitle>
                <p className="text-sm text-muted">{t("timeline.trend.sub")}</p>
              </CardHeader>
              <CardContent>
                <DailyTrendChart
                  data={trend}
                  activeLabel={t("common.active")}
                  idleLabel={t("common.idle")}
                />
              </CardContent>
            </Card>

            <Card className="animate-fade-up">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("timeline.intraday.heading")}
                </CardTitle>
                <p className="text-sm text-muted">
                  {t("timeline.intraday.sub")}
                </p>
              </CardHeader>
              <CardContent>
                {intraday.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">
                    {t("timeline.empty")}
                  </p>
                ) : (
                  <IntradayChart
                    data={intraday}
                    seriesLabel={t("timeline.intraday.series")}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle className="text-base">
                {t("timeline.heatmap.heading")}
              </CardTitle>
              <p className="text-sm text-muted">{t("timeline.heatmap.sub")}</p>
            </CardHeader>
            <CardContent>
              <HourHeatmap data={heatmap} />
            </CardContent>
          </Card>

          {/* Per-hour state breakdown — what they were doing each hour today. */}
          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle className="text-base">
                {t("timeline.hourly.heading")}
              </CardTitle>
              <p className="text-sm text-muted">{t("timeline.hourly.sub")}</p>
            </CardHeader>
            <CardContent>
              {!employeeId ? (
                <p className="py-8 text-center text-sm text-muted">
                  {t("timeline.hourly.unlinked")}
                </p>
              ) : stateHistory === undefined ? (
                <Skeleton className="h-56 w-full" />
              ) : stateHistory.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  {t("timeline.hourly.empty")}
                </p>
              ) : (
                <HourlyStateChart data={hourlyStates} labels={stateLabels} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          {samples.length === 0 ? (
            <p className="py-8 text-center text-muted">{t("timeline.empty")}</p>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("timeline.time")}</TableHead>
                    <TableHead>{t("timeline.state")}</TableHead>
                    <TableHead>{t("timeline.idle")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samples.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell className="tabular-nums">
                        {formatTime(s.capturedAt, lang)}
                      </TableCell>
                      <TableCell>
                        <span className={s.active ? "text-ok" : "text-warn"}>
                          {s.active ? t("common.active") : t("common.idle")}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted">
                        {formatDuration(Math.floor(s.idleMs / 1000), lang)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export">
          <Card className="animate-fade-up max-w-xl">
            <CardHeader>
              <CardTitle className="text-base">
                {t("timeline.export.heading")}
              </CardTitle>
              <p className="text-sm text-muted">{t("timeline.export.sub")}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t("timeline.export.from")}
                  <Input
                    type="date"
                    value={exportStart}
                    max={exportEnd}
                    onChange={(e) => setExportStart(e.target.value)}
                    className="w-40"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t("timeline.export.to")}
                  <Input
                    type="date"
                    value={exportEnd}
                    min={exportStart}
                    max={today}
                    onChange={(e) => setExportEnd(e.target.value)}
                    className="w-40"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => void runExport("csv")}
                  disabled={exporting}
                >
                  <Download className="h-4 w-4" />
                  {t("timeline.export.csv")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void runExport("json")}
                  disabled={exporting}
                >
                  <Download className="h-4 w-4" />
                  {t("timeline.export.json")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
