"use client";

import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import type { EmployeeState } from "@activitytrack/shared";
import { useI18n } from "@/lib/i18n";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/Skeleton";
import { QueryState } from "@/components/QueryState";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

/** Badge tone + whether the state should show a live "signal" pulse. */
const STATE_STYLE: Record<
  EmployeeState,
  { variant: "default" | "ok" | "warn" | "danger" | "muted" | "outline"; live?: boolean }
> = {
  IN_CALL: { variant: "default", live: true },
  WRAP_UP: { variant: "warn", live: true },
  ACTIVE: { variant: "ok", live: true },
  BREAK: { variant: "muted" },
  ABSENT: { variant: "muted" },
  IDLE: { variant: "warn" },
};

/** A single signal chip (source + value), greyed out when unknown. */
function Signal({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border-soft py-1.5 text-xs first:border-t-0">
      <span className="font-mono uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className={cn("tabular-nums", value ? "text-fg/80" : "text-muted/50")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function LiveStatePage() {
  const { t, lang } = useI18n();
  const rows = useQuery(api.state.overview);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tightest text-fg">
          {t("state.heading")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("state.subtitle")}</p>
      </div>

      <QueryState
        data={rows}
        loading={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
        empty={
          <Card className="signal-grid">
            <CardContent className="py-16 text-center text-muted">
              {t("state.empty")}
            </CardContent>
          </Card>
        }
      >
        {(data) => (
          <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((r, index) => {
              const style = STATE_STYLE[r.finalState as EmployeeState];
              return (
                <StaggerItem key={r.employeeId} index={index}>
                  <Card className="relative h-full overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-fg">
                          {r.personName ?? r.employeeId}
                        </span>
                        <Badge
                          variant={style.variant}
                          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider"
                        >
                          {style.live && <span className="signal-dot !h-1.5 !w-1.5" />}
                          {t(`empstate.${r.finalState}`)}
                        </Badge>
                      </div>

                      {r.deviceIdle && r.idleSeconds != null && (
                        <p className="mt-1 text-xs text-muted">
                          {t("state.idleFor", {
                            duration: formatDuration(r.idleSeconds, lang),
                          })}
                        </p>
                      )}

                      <div className="mt-3">
                        <Signal
                          label={t("state.source.agent")}
                          value={
                            r.deviceIdle == null
                              ? null
                              : r.deviceIdle
                                ? t("common.idle")
                                : t("common.active")
                          }
                        />
                        <Signal
                          label={t("state.source.genesys")}
                          value={r.genesysRoutingStatus ?? r.genesysPresence}
                        />
                        <Signal
                          label={t("state.source.clockodo")}
                          value={
                            r.clockodoAbsent
                              ? t("empstate.ABSENT")
                              : r.clockodoBreak
                                ? t("empstate.BREAK")
                                : r.clockodoWorking == null
                                  ? null
                                  : r.clockodoWorking
                                    ? t("common.active")
                                    : "—"
                          }
                        />
                      </div>

                      <p className="mt-3 border-t border-border-soft pt-2.5 font-mono text-[11px] text-muted">
                        {t("state.updated")}{" "}
                        <span className="text-fg/80">
                          {formatRelativeTime(r.updatedAt, lang)}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </QueryState>
    </div>
  );
}
