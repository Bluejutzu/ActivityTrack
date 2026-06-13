"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/format";
import { SkeletonRow } from "@/components/Skeleton";
import { useToast } from "@/lib/useToast";

const ROLES: Role[] = ["it_admin", "manager", "viewer"];

export default function UsersPage() {
  const { t } = useI18n();
  const toast = useToast();
  const users = useQuery(api.users.list);
  const setRole = useMutation(api.users.setRole);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (users === undefined) {
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
      <h1 className="mb-4 text-xl font-semibold">{t("users.heading")}</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-muted">
            <tr>
              <th className="px-3 py-2">{t("users.email")}</th>
              <th className="px-3 py-2">{t("users.name")}</th>
              <th className="px-3 py-2">{t("users.role")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t border-border">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 text-muted">{u.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={busyId === u._id}
                    onChange={async (e) => {
                      setBusyId(u._id);
                      await setRole({ userId: u._id, role: e.target.value as Role });
                      setBusyId(null);
                      toast(t("users.roleUpdated"), "ok");
                    }}
                    className="rounded-md border border-border bg-bg px-2 py-1 disabled:opacity-50 transition-opacity duration-150"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`role.${r}`)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
