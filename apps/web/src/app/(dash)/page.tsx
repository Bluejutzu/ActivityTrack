"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EmployeeState } from "@activitytrack/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/Skeleton";
import { QueryState } from "@/components/QueryState";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { HealthBanner, StateBadge } from "@/components/state/StateBits";

/** Compact mono read-out of the fleet's current state. */
function FleetSummary({
  rows,
}: {
  rows: { online: boolean; active: boolean }[];
}) {
  const { t } = useI18n();
  const working = rows.filter((d) => d.online && d.active).length;
  const idle = rows.filter((d) => d.online && !d.active).length;
  const offline = rows.filter((d) => !d.online).length;

  const stats: { label: string; value: number; tone: string; live?: boolean }[] = [
    { label: t("overview.working"), value: working, tone: "text-ok", live: working > 0 },
    { label: t("overview.idleNow"), value: idle, tone: "text-warn" },
    { label: t("overview.offline"), value: offline, tone: "text-muted" },
    { label: t("overview.total"), value: rows.length, tone: "text-fg" },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-panel px-4 py-3.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            {s.live && <span className="signal-dot !h-1.5 !w-1.5" />}
            {s.label}
          </span>
          <span className={cn("text-3xl font-semibold tabular-nums", s.tone)}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const { t, lang } = useI18n();
  const team = useQuery(api.stats.teamOverview);

  return (
    <QueryState
      data={team}
      loading={
        <div className="space-y-5">
          <div className="h-[88px] animate-pulse rounded-xl border border-border bg-panel/60" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      }
      empty={
        <Card className="signal-grid">
          <CardContent className="py-16 text-center text-muted">
            {t("overview.empty")}
          </CardContent>
        </Card>
      }
    >
      {(rows) => (
        <div className="space-y-5">
          <HealthBanner />
          <FleetSummary rows={rows} />
          <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((d, index) => {
              // Prefer the fused state (on call / break / absent / …) when we
              // have it and the device is online; fall back to the basic
              // working/idle/offline read otherwise.
              const offline = !d.online;
              const basic = offline ? "offline" : d.active ? "working" : "idle";
              const basicVariant =
                basic === "working" ? "ok" : basic === "idle" ? "warn" : "muted";
              const basicLabel =
                basic === "working"
                  ? t("overview.working")
                  : basic === "idle"
                    ? t("overview.idleNow")
                    : t("overview.offline");
              const showFused = !offline && d.finalState != null;
              return (
                <StaggerItem key={d.deviceId} index={index}>
                  <Link
                    href={`/timeline/${encodeURIComponent(d.deviceId)}`}
                    className="group block h-full"
                  >
                    <Card className="relative h-full overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/50 group-hover:shadow-glow">
                      {/* signal line that ignites along the top edge on hover */}
                      <span className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-signal-line transition-transform duration-300 group-hover:scale-x-100" />
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-fg">
                            {d.personName ?? d.hostname}
                          </span>
                          {showFused ? (
                            <StateBadge state={d.finalState as EmployeeState} />
                          ) : (
                            <Badge
                              variant={basicVariant}
                              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider"
                            >
                              {basic === "working" && (
                                <span className="signal-dot !h-1.5 !w-1.5" />
                              )}
                              {basicLabel}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted">
                          {d.personName ? d.hostname : t("overview.unassigned")} ·{" "}
                          {d.windowsUser}
                        </p>
                        <p className="mt-4 font-display text-2xl font-semibold tabular-nums text-fg">
                          {formatDuration(d.todayActiveSeconds, lang)}
                          <span className="ml-2 font-sans text-xs font-normal text-muted">
                            {t("overview.todayActive")}
                          </span>
                        </p>
                        <div className="mt-2 flex items-center justify-between border-t border-border-soft pt-2.5">
                          <p className="font-mono text-[11px] text-muted">
                            {t("overview.lastSeen")}{" "}
                            <span className="text-fg/80">
                              {formatRelativeTime(d.lastSeen, lang)}
                            </span>
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
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      )}
    </QueryState>
  );
}
