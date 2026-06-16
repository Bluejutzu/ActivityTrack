"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, Clock, Coffee, Radio } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import type { EmployeeState } from "@activitytrack/shared";
import { useI18n } from "@/lib/i18n";
import {
  formatDuration,
  formatRelativeTime,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge, SourceSignals } from "@/components/state/StateBits";
import { ChartsTab } from "@/components/timeline/ChartsTab";
import { RawTab } from "@/components/timeline/RawTab";
import { ExportTab } from "@/components/timeline/ExportTab";
import { DayDetailTab } from "@/components/timeline/DayDetailTab";

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
  const fileLabel = device?.personName ?? device?.hostname ?? deviceId;

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
          <TabsTrigger value="day">{t("timeline.tabs.day")}</TabsTrigger>
          <TabsTrigger value="raw">{t("timeline.tabs.raw")}</TabsTrigger>
          <TabsTrigger value="export">{t("timeline.tabs.export")}</TabsTrigger>
        </TabsList>

        <TabsContent value="charts">
          <ChartsTab
            trend={trend}
            heatmap={heatmap}
            intraday={intraday}
            hourlyStates={hourlyStates}
            stateLabels={stateLabels}
            employeeId={employeeId}
            stateHistory={stateHistory}
          />
        </TabsContent>

        <TabsContent value="day">
          <DayDetailTab employeeId={employeeId} today={today} />
        </TabsContent>

        <TabsContent value="raw">
          <RawTab samples={samples} />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab
            deviceId={deviceId}
            fileLabel={fileLabel}
            startDay={startDay}
            today={today}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
