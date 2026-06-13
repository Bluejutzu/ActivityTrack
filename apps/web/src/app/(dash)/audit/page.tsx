"use client";

import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import { SkeletonRow } from "@/components/Skeleton";

export default function AuditPage() {
  const { t, lang } = useI18n();
  const rows = useQuery(api.audit.list, {});

  if (rows === undefined) {
    return (
      <section>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{t("audit.heading")}</h1>
      {rows.length === 0 ? (
        <p className="text-muted">{t("audit.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-muted">
              <tr>
                <th className="px-3 py-2">{t("audit.when")}</th>
                <th className="px-3 py-2">{t("audit.actor")}</th>
                <th className="px-3 py-2">{t("audit.action")}</th>
                <th className="px-3 py-2">{t("audit.target")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t border-border transition-colors duration-100 hover:bg-panel/30">
                  <td className="px-3 py-2 text-muted">
                    {formatTime(r.at, lang)}
                  </td>
                  <td className="px-3 py-2">{r.actorName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2 text-muted">{r.target ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
