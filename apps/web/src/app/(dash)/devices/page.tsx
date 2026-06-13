"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatTime, roleAtLeast, type Role } from "@/lib/format";

export default function DevicesPage() {
  const { t, lang } = useI18n();
  const me = useQuery(api.users.me);
  const devices = useQuery(api.devices.list);
  const people = useQuery(api.people.list);

  const approve = useMutation(api.devices.approve);
  const disable = useMutation(api.devices.disable);
  const link = useMutation(api.devices.link);

  const role = (me?.role ?? "viewer") as Role;
  const isAdmin = roleAtLeast(role, "it_admin");
  const isManager = roleAtLeast(role, "manager");

  if (devices === undefined || people === undefined) {
    return <p className="text-muted">{t("common.loading")}</p>;
  }

  const statusLabel: Record<string, string> = {
    pending: t("status.pending"),
    active: t("status.active"),
    disabled: t("status.disabled"),
  };
  const statusClass: Record<string, string> = {
    pending: "bg-warn/20 text-warn",
    active: "bg-ok/20 text-ok",
    disabled: "bg-danger/20 text-danger",
  };

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{t("devices.heading")}</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-muted">
            <tr>
              <th className="px-3 py-2">{t("devices.host")}</th>
              <th className="px-3 py-2">{t("devices.user")}</th>
              <th className="px-3 py-2">{t("devices.status")}</th>
              <th className="px-3 py-2">{t("devices.person")}</th>
              <th className="px-3 py-2">{t("devices.lastSeen")}</th>
              <th className="px-3 py-2">{t("devices.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d._id} className="border-t border-border">
                <td className="px-3 py-2">{d.hostname}</td>
                <td className="px-3 py-2 text-muted">{d.lastWindowsUser}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[d.status]}`}>
                    {statusLabel[d.status]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {isManager ? (
                    <select
                      value={d.personId ?? ""}
                      onChange={(e) =>
                        void link({
                          deviceId: d._id,
                          personId: e.target.value
                            ? (e.target.value as (typeof people)[number]["_id"])
                            : null,
                        })
                      }
                      className="rounded-md border border-border bg-bg px-2 py-1"
                    >
                      <option value="">{t("devices.none")}</option>
                      {people.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (d.personName ?? t("devices.none"))
                  )}
                </td>
                <td className="px-3 py-2 text-muted">
                  {formatTime(d.lastSeen, lang)}
                </td>
                <td className="px-3 py-2">
                  {isAdmin && (
                    <div className="flex gap-2">
                      {d.status !== "active" && (
                        <button
                          onClick={() => void approve({ deviceId: d._id })}
                          className="rounded-md bg-ok/20 px-2 py-1 text-xs text-ok"
                        >
                          {t("devices.approve")}
                        </button>
                      )}
                      {d.status !== "disabled" && (
                        <button
                          onClick={() => void disable({ deviceId: d._id })}
                          className="rounded-md bg-danger/20 px-2 py-1 text-xs text-danger"
                        >
                          {t("devices.disable")}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
