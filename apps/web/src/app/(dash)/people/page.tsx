"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { roleAtLeast, type Role } from "@/lib/format";

export default function PeoplePage() {
  const { t } = useI18n();
  const me = useQuery(api.users.me);
  const people = useQuery(api.people.list);
  const create = useMutation(api.people.create);
  const update = useMutation(api.people.update);
  const remove = useMutation(api.people.remove);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const canEdit = roleAtLeast((me?.role ?? "viewer") as Role, "manager");

  if (people === undefined) {
    return <p className="text-muted">{t("common.loading")}</p>;
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create({ name: name.trim(), email: email.trim() || undefined });
    setName("");
    setEmail("");
  }

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{t("people.heading")}</h1>

      {canEdit && (
        <form
          onSubmit={onAdd}
          className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-panel p-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("people.name")}
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("people.email")}
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2"
          />
          <button className="rounded-md bg-accent px-4 py-2 text-white">
            {t("people.add")}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-muted">
            <tr>
              <th className="px-3 py-2">{t("people.name")}</th>
              <th className="px-3 py-2">{t("people.email")}</th>
              <th className="px-3 py-2">{t("people.active")}</th>
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p._id} className="border-t border-border">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-muted">{p.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={p.active}
                    disabled={!canEdit}
                    onChange={(e) =>
                      void update({ personId: p._id, active: e.target.checked })
                    }
                  />
                </td>
                {canEdit && (
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm(t("people.confirmDelete")))
                          void remove({ personId: p._id });
                      }}
                      className="text-xs text-danger"
                    >
                      {t("people.delete")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
