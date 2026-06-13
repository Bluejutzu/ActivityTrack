"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatDuration, formatTime, todayLocalDay } from "@/lib/format";
import { SkeletonCard, SkeletonRow } from "@/components/Skeleton";

export default function TimelinePage({
  params,
}: {
  params: { deviceId: string };
}) {
  const { t, lang } = useI18n();
  const deviceId = decodeURIComponent(params.deviceId);

  const samples = useQuery(api.stats.recentSamples, { deviceId, limit: 200 });
  const today = todayLocalDay();
  const daily = useQuery(api.stats.dailyRange, {
    deviceId,
    startDay: today,
    endDay: today,
  });

  const todayStats = daily?.[0];

  if (samples === undefined) {
    return (
      <section>
        <div className="mb-5 flex gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>{[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Link href="/" className="group text-sm text-accent">
        <span className="transition-transform duration-150 group-hover:-translate-x-0.5">←</span> {t("timeline.back")}
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-semibold">{t("timeline.heading")}</h1>
      <p className="mb-4 font-mono text-xs text-muted">{deviceId}</p>

      {todayStats && (
        <div className="mb-5 flex gap-3 animate-fade-up">
          <div className="rounded-xl border border-border bg-panel px-4 py-3">
            <p className="text-xs text-muted">{t("common.active")}</p>
            <p className="text-lg text-ok">
              {formatDuration(todayStats.activeSeconds, lang)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-panel px-4 py-3">
            <p className="text-xs text-muted">{t("common.idle")}</p>
            <p className="text-lg text-warn">
              {formatDuration(todayStats.idleSeconds, lang)}
            </p>
          </div>
        </div>
      )}

      {samples.length === 0 ? (
        <p className="text-muted">{t("timeline.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-muted">
              <tr>
                <th className="px-3 py-2">{t("timeline.time")}</th>
                <th className="px-3 py-2">{t("timeline.state")}</th>
                <th className="px-3 py-2">{t("timeline.idle")}</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => (
                <tr key={s._id} className="border-t border-border transition-colors duration-100 hover:bg-panel/30">
                  <td className="px-3 py-2 tabular-nums">
                    {formatTime(s.capturedAt, lang)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={s.active ? "text-ok" : "text-warn"}>
                      {s.active ? t("common.active") : t("common.idle")}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted">
                    {formatDuration(Math.floor(s.idleMs / 1000), lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
