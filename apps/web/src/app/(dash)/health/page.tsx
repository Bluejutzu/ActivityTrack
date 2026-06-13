"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatDuration, formatTime, roleAtLeast, type Role } from "@/lib/format";
import { useMutationWithToast } from "@/lib/useMutationWithToast";
import { SkeletonCard, SkeletonRow } from "@/components/Skeleton";

type Severity = "info" | "warning" | "error" | "critical";

const SEV_DOT: Record<Severity, string> = {
  info: "bg-muted",
  warning: "bg-warn",
  error: "bg-danger",
  critical: "bg-danger",
};

const SEV_BADGE: Record<Severity, string> = {
  info: "bg-muted/10 text-muted",
  warning: "bg-warn/15 text-warn",
  error: "bg-danger/15 text-danger",
  critical: "bg-danger/25 text-danger",
};

/** Friendly one-liner for an event code, falling back gracefully. */
function friendly(
  t: (k: string, v?: Record<string, string | number>) => string,
  code: string,
): string {
  const key = `health.friendly.${code}`;
  const msg = t(key);
  return msg === key ? t("health.friendly.unknown") : msg;
}

export default function HealthPage() {
  const { t, lang } = useI18n();
  const me = useQuery(api.users.me);
  const health = useQuery(api.events.health);
  const isAdmin = roleAtLeast((me?.role ?? "viewer") as Role, "it_admin");

  const [onlyOpen, setOnlyOpen] = useState(true);
  const events = useQuery(
    api.events.listEvents,
    isAdmin ? { onlyOpen } : "skip",
  );

  const resolve = useMutationWithToast(api.events.resolveEvent);

  if (health === undefined) {
    return (
      <section className="space-y-6">
        <SkeletonCard />
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    );
  }

  const attentionCount = health.offlineDevices.length + health.openEventCount;
  const allGood = attentionCount === 0;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{t("health.heading")}</h1>
        <p className="mt-1 text-sm text-muted">{t("health.subtitle")}</p>
      </div>

      {/* ── Status banner ─────────────────────────────────────────────── */}
      {allGood ? (
        <div className="flex items-center gap-3 rounded-xl border border-ok/30 bg-ok/5 p-5 animate-fade-up">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
            ✓
          </span>
          <div>
            <p className="font-medium text-ok">{t("health.allGood.title")}</p>
            <p className="text-sm text-muted">{t("health.allGood.body")}</p>
          </div>
        </div>
      ) : (
        <div
          className={`flex items-center gap-3 rounded-xl border p-5 animate-fade-up ${
            health.worstSeverity === "info" || health.worstSeverity === "warning"
              ? "border-warn/30 bg-warn/5"
              : "border-danger/30 bg-danger/5"
          }`}
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span
              className={`absolute inline-flex h-3 w-3 rounded-full ${
                health.worstSeverity === "info" ||
                health.worstSeverity === "warning"
                  ? "bg-warn"
                  : "bg-danger"
              } animate-pulse-dot`}
            />
          </span>
          <div>
            <p className="font-medium text-fg">
              {t("health.attention.title", { count: attentionCount })}
            </p>
            <p className="text-sm text-muted">{t("health.attention.body")}</p>
          </div>
        </div>
      )}

      {/* ── Offline devices (friendly) ────────────────────────────────── */}
      {health.offlineDevices.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("health.offline.heading")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {health.offlineDevices.map((d) => (
              <div
                key={d.deviceId}
                className="rounded-xl border border-border bg-panel p-4 animate-fade-up"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
                  <p className="font-medium">
                    {d.personName ?? d.hostname}
                  </p>
                </div>
                {d.personName && (
                  <p className="mt-0.5 text-xs text-muted">{d.hostname}</p>
                )}
                <p className="mt-2 text-sm text-muted">
                  {t("health.offline.for", {
                    duration: formatDuration(d.offlineForMs / 1000, lang),
                  })}
                </p>
                <p className="text-xs text-muted">
                  {t("health.offline.lastSeen", {
                    time: formatTime(d.lastSeen, lang),
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Reported issues (friendly digest) ─────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("health.issues.heading")}
        </h2>
        {health.recentIssues.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            {t("health.issues.none")}
          </p>
        ) : (
          <ul className="space-y-2">
            {health.recentIssues.map((issue) => (
              <li
                key={issue.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-panel p-4 animate-fade-up"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEV_DOT[issue.severity]}`}
                />
                <div className="flex-1">
                  <p className="text-sm">{friendly(t, issue.code)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {issue.hostname ? `${issue.hostname} · ` : ""}
                    {issue.count > 1 &&
                      `${t("health.issues.occurrences", { count: issue.count })} · `}
                    {t("health.issues.lastAt", {
                      time: formatTime(issue.lastAt, lang),
                    })}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() =>
                      void resolve(
                        { eventId: issue.id },
                        { success: t("health.resolved") },
                      )
                    }
                    className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors duration-150 hover:text-fg hover:border-border/80"
                  >
                    {t("health.resolve")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Technical detail (IT only) ────────────────────────────────── */}
      {isAdmin && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t("health.detail.heading")}
            </h2>
            <button
              onClick={() => setOnlyOpen((v) => !v)}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors duration-150 hover:text-fg"
            >
              {onlyOpen ? t("health.detail.toggleAll") : t("health.detail.toggleOpen")}
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-panel text-left text-muted">
                <tr>
                  <th className="px-3 py-2">{t("health.detail.severity")}</th>
                  <th className="px-3 py-2">{t("health.detail.event")}</th>
                  <th className="px-3 py-2">{t("health.detail.message")}</th>
                  <th className="px-3 py-2">{t("health.detail.source")}</th>
                  <th className="px-3 py-2">{t("health.detail.device")}</th>
                  <th className="px-3 py-2">{t("health.detail.count")}</th>
                  <th className="px-3 py-2">{t("health.detail.lastAt")}</th>
                  <th className="px-3 py-2">{t("health.detail.status")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {events === undefined ? (
                  [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
                ) : events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-8 text-center text-muted"
                    >
                      {t("health.detail.empty")}
                    </td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr
                      key={e._id}
                      className="border-t border-border align-top transition-colors duration-100 hover:bg-panel/30"
                    >
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEV_BADGE[e.severity]}`}
                        >
                          {t(`health.sev.${e.severity}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{e.code}</td>
                      <td className="px-3 py-2 text-muted">
                        {e.message}
                        {e.context && (
                          <span className="mt-0.5 block font-mono text-[11px] text-muted/70">
                            {e.context}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {t(`health.src.${e.source}`)}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {e.hostname ?? e.deviceId ?? "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{e.count}</td>
                      <td className="px-3 py-2 text-muted">
                        {formatTime(e.lastAt, lang)}
                      </td>
                      <td className="px-3 py-2">
                        {e.resolvedAt ? (
                          <span className="text-xs text-ok">
                            {t("health.detail.statusResolved")}
                          </span>
                        ) : (
                          <span className="text-xs text-warn">
                            {t("health.detail.statusOpen")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!e.resolvedAt && (
                          <button
                            onClick={() =>
                              void resolve(
                                { eventId: e._id },
                                { success: t("health.resolved") },
                              )
                            }
                            className="rounded-md border border-border px-2 py-0.5 text-xs text-muted transition-colors duration-150 hover:text-fg"
                          >
                            {t("health.resolve")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
