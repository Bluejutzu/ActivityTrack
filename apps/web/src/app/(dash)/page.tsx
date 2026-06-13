"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatDuration, formatTime } from "@/lib/format";
import { SkeletonCard } from "@/components/Skeleton";

export default function OverviewPage() {
  const { t, lang } = useI18n();
  const team = useQuery(api.stats.teamOverview);

  if (team === undefined) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{t("overview.heading")}</h1>
      {team.length === 0 ? (
        <p className="text-muted">{t("overview.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((d, index) => {
            const state = !d.online
              ? "offline"
              : d.active
                ? "working"
                : "idle";
            const badge =
              state === "working"
                ? "bg-ok/20 text-ok"
                : state === "idle"
                  ? "bg-warn/20 text-warn"
                  : "bg-border text-muted";
            const label =
              state === "working"
                ? t("overview.working")
                : state === "idle"
                  ? t("overview.idleNow")
                  : t("overview.offline");
            return (
              <Link
                key={d.deviceId}
                href={`/timeline/${encodeURIComponent(d.deviceId)}`}
                className="animate-fade-up rounded-xl border border-border bg-panel p-4 transition-all duration-200 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {d.personName ?? d.hostname}
                  </span>
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
                    {state === "working" && (
                      <span className="inline-block h-2 w-2 rounded-full bg-ok animate-pulse-dot" />
                    )}
                    {label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {d.personName ? d.hostname : t("overview.unassigned")} ·{" "}
                  {d.windowsUser}
                </p>
                <p className="mt-3 text-lg">
                  {formatDuration(d.todayActiveSeconds, lang)}{" "}
                  <span className="text-sm text-muted">
                    {t("overview.todayActive")}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t("overview.lastSeen")}: {formatTime(d.lastSeen, lang)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
