"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, Clock, Coffee, Radio } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
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
  intradayTimeline,
  type Sample,
} from "@/lib/activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  // Aggregations (memoised; samples can be up to 1000 rows).
  const { trend, heatmap, intraday } = useMemo(() => {
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
    };
  }, [samples, daily, startDay, today]);

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
          value={
            device ? formatRelativeTime(device.lastSeen, lang) : "—"
          }
        />
      </div>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">{t("timeline.tabs.charts")}</TabsTrigger>
          <TabsTrigger value="raw">{t("timeline.tabs.raw")}</TabsTrigger>
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
      </Tabs>
    </section>
  );
}
