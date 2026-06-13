"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { roleAtLeast, type Role } from "@/lib/format";
import type { GenericId } from "convex/values";
import { SkeletonRow } from "@/components/Skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/lib/useToast";

export default function PeoplePage() {
  const { t } = useI18n();
  const me = useQuery(api.users.me);
  const people = useQuery(api.people.list);
  const create = useMutation(api.people.create);
  const update = useMutation(api.people.update);
  const remove = useMutation(api.people.remove);

  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GenericId<"people"> | null>(null);

  const canEdit = roleAtLeast((me?.role ?? "viewer") as Role, "manager");

  if (people === undefined) {
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
          className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-panel p-3 animate-fade-up"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("people.name")}
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2 transition-colors duration-150 focus:border-accent/60"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("people.email")}
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2 transition-colors duration-150 focus:border-accent/60"
          />
          <button className="rounded-md bg-accent px-4 py-2 text-white transition-colors duration-150 hover:bg-accent/80 active:scale-95">
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
              <tr key={p._id} className="border-t border-border transition-colors duration-100 hover:bg-panel/30">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-muted">{p.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={p.active}
                    disabled={!canEdit}
                    onChange={(e) => {
                      void update({ personId: p._id, active: e.target.checked }).then(() =>
                        toast(t("people.updated"), "ok")
                      );
                    }}
                  />
                </td>
                {canEdit && (
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setDeleteTarget(p._id)}
                      className="text-xs text-danger transition-colors duration-150 hover:text-danger/80"
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

      <ConfirmDialog
        open={deleteTarget !== null}
        heading={t("people.confirmDelete")}
        confirmLabel={t("people.delete")}
        onConfirm={async () => {
          if (deleteTarget) {
            await remove({ personId: deleteTarget });
            toast(t("people.deleted"), "ok");
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
