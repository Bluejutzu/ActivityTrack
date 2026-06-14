"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  if (team.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted">
          {t("overview.empty")}
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {team.map((d, index) => {
        const state = !d.online ? "offline" : d.active ? "working" : "idle";
        const variant =
          state === "working" ? "ok" : state === "idle" ? "warn" : "muted";
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
            className="group animate-fade-up"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/50 group-hover:shadow-glow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-fg">
                    {d.personName ?? d.hostname}
                  </span>
                  <Badge variant={variant} className="flex items-center gap-1.5">
                    {state === "working" && (
                      <span className="inline-block h-2 w-2 rounded-full bg-ok animate-pulse-dot" />
                    )}
                    {label}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  {d.personName ? d.hostname : t("overview.unassigned")} ·{" "}
                  {d.windowsUser}
                </p>
                <p className="mt-3 text-lg text-fg">
                  {formatDuration(d.todayActiveSeconds, lang)}{" "}
                  <span className="text-sm text-muted">
                    {t("overview.todayActive")}
                  </span>
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted">
                    {t("overview.lastSeen")}:{" "}
                    {formatRelativeTime(d.lastSeen, lang)}
                  </p>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted transition-transform duration-150",
                      "group-hover:translate-x-0.5 group-hover:text-accent",
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </section>
  );
}
