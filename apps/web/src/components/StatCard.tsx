import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Tone = "fg" | "ok" | "warn" | "muted" | "accent";

const TONE: Record<Tone, string> = {
  fg: "text-fg",
  ok: "text-ok",
  warn: "text-warn",
  muted: "text-muted",
  accent: "text-accent",
};

const TILE: Record<Tone, string> = {
  fg: "bg-panel-2 text-muted ring-border",
  ok: "bg-ok/12 text-ok ring-ok/25",
  warn: "bg-warn/12 text-warn ring-warn/25",
  muted: "bg-panel-2 text-muted ring-border",
  accent: "bg-accent/12 text-accent ring-accent/25",
};

/**
 * A stat / KPI tile. The label + icon are pinned to the top and the figure is
 * pinned to the bottom (justify-between + a min-height), so the content always
 * spans the full card — no top-clinging dead space. The figure is the single
 * focal point; integers read well in the serif display face, durations/relative
 * times read better in tabular sans (pass `valueClassName` to switch).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "fg",
  live,
  className,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  live?: boolean;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <Card
      className={cn(
        "h-full transition-shadow duration-200 hover:shadow-card-hover",
        className,
      )}
    >
      <CardContent className="flex h-full min-h-[7.5rem] flex-col justify-between gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="kicker flex items-center gap-1.5 truncate pt-0.5">
            {live && <span className="signal-dot !h-1.5 !w-1.5" />}
            {label}
          </span>
          {icon && (
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                TILE[tone],
              )}
            >
              {icon}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "font-display text-display-sm font-medium leading-none tracking-tight",
              TONE[tone],
              valueClassName,
            )}
          >
            {value}
          </div>
          {hint && <p className="mt-1.5 truncate text-xs text-muted">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
