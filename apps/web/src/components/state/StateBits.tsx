"use client";

import { AlertTriangle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import type { EmployeeState } from "@activitytrack/shared";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Shared building blocks for the fused employee state, used on both the Overview
 * cards and the device timeline (the old standalone Live-Status page folded into
 * these). One home for the badge tone map, the per-source signal chips, and the
 * integration-health banner.
 */

/** Badge tone + whether the state should show a live "signal" pulse. */
export const STATE_STYLE: Record<
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

/** The fused-state badge (live dot + localised label). */
export function StateBadge({ state }: { state: EmployeeState }) {
  const { t } = useI18n();
  const style = STATE_STYLE[state];
  return (
    <Badge
      variant={style.variant}
      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider"
    >
      {style.live && <span className="signal-dot !h-1.5 !w-1.5" />}
      {t(`empstate.${state}`)}
    </Badge>
  );
}

/** A single signal chip (source + value), greyed out when unknown. */
export function Signal({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border-soft py-1.5 text-xs first:border-t-0">
      <span className="font-mono uppercase tracking-wider text-muted">{label}</span>
      <span className={cn("tabular-nums", value ? "text-fg/80" : "text-muted/50")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/** Per-source signals (workstation / Genesys / Clockodo) for one employee. */
export function SourceSignals({
  deviceIdle,
  genesysRoutingStatus,
  genesysPresence,
  clockodoWorking,
  clockodoBreak,
  clockodoAbsent,
}: {
  deviceIdle: boolean | null;
  genesysRoutingStatus: string | null;
  genesysPresence: string | null;
  clockodoWorking: boolean | null;
  clockodoBreak: boolean | null;
  clockodoAbsent: boolean | null;
}) {
  const { t } = useI18n();
  return (
    <div>
      <Signal
        label={t("state.source.agent")}
        value={
          deviceIdle == null
            ? null
            : deviceIdle
              ? t("common.idle")
              : t("common.active")
        }
      />
      <Signal
        label={t("state.source.genesys")}
        value={genesysRoutingStatus ?? genesysPresence}
      />
      <Signal
        label={t("state.source.clockodo")}
        value={
          clockodoAbsent
            ? t("empstate.ABSENT")
            : clockodoBreak
              ? t("empstate.BREAK")
              : clockodoWorking == null
                ? null
                : clockodoWorking
                  ? t("common.active")
                  : "—"
        }
      />
    </div>
  );
}

/**
 * Per-source availability banner. A down/unconfigured integration shows here
 * with its reason; it never blocks the rest — the fused state simply stops using
 * that signal. Renders nothing when every source is healthy.
 */
export function HealthBanner() {
  const { t } = useI18n();
  const health = useQuery(api.state.health);
  const degraded = (health ?? []).filter((h) => h.status !== "ok");
  if (degraded.length === 0) return null;

  return (
    <div className="space-y-2">
      {degraded.map((h) => {
        const source = t(`state.source.${h.source}`);
        const text =
          h.status === "unconfigured"
            ? t("state.health.unconfigured", { source })
            : t("state.health.unavailable", {
                source,
                reason: h.message ?? "—",
              });
        return (
          <div
            key={h.source}
            className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div className="min-w-0">
              <p className="text-sm text-fg">{text}</p>
              <p className="mt-0.5 text-xs text-muted">{t("state.health.degraded")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
