"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { roleAtLeast, type Role } from "@/lib/format";
import type { GenericId } from "convex/values";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useMutationWithToast } from "@/lib/useMutationWithToast";
import { useToast } from "@/lib/useToast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Inline-editable id cell. Saves on blur (and Enter) only when the value
 * actually changed, so the integration mappings can be maintained right in the
 * roster without a modal.
 */
function EditableId({
  initial,
  disabled,
  placeholder,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  placeholder: string;
  onSave: (value: string) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [value, setValue] = useState(initial);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast(t("common.copied"), "ok");
    } catch {
      toast(t("common.copyFailed"), "danger");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== initial) onSave(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-8 min-w-[7rem] font-mono text-xs"
      />
      {value.trim() !== "" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={copy}
          aria-label={t("common.copy")}
          className="h-8 w-8 shrink-0 text-muted hover:text-fg"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default function PeoplePage() {
  const { t } = useI18n();
  const me = useQuery(api.users.me);
  const people = useQuery(api.people.list);
  const create = useMutationWithToast(api.people.create);
  const update = useMutationWithToast(api.people.update);
  const remove = useMutationWithToast(api.people.remove);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GenericId<"people"> | null>(
    null,
  );

  const canEdit = roleAtLeast((me?.role ?? "viewer") as Role, "manager");

  if (people === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await create({
      name: name.trim(),
      email: email.trim() || undefined,
    });
    if (created) {
      setName("");
      setEmail("");
    }
  }

  return (
    <section className="space-y-5">
      {canEdit && (
        <Card className="animate-fade-up">
          <CardContent className="p-3">
            <form
              onSubmit={onAdd}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("people.name")}
                className="sm:flex-1"
              />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("people.email")}
                className="sm:flex-1"
              />
              <Button type="submit" className="sm:w-auto">
                <Plus className="h-4 w-4" />
                {t("people.add")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table aria-label={t("nav.people")}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("people.name")}</TableHead>
              <TableHead>{t("people.email")}</TableHead>
              <TableHead>{t("people.employeeId")}</TableHead>
              <TableHead>{t("people.genesysId")}</TableHead>
              <TableHead>{t("people.clockodoId")}</TableHead>
              <TableHead>{t("people.active")}</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 7 : 6}
                  className="py-10 text-center text-sm text-muted"
                >
                  {t("people.empty")}
                </TableCell>
              </TableRow>
            )}
            {people.map((p) => (
              <TableRow key={p._id}>
                <TableCell className="text-fg">{p.name}</TableCell>
                <TableCell className="text-muted">{p.email ?? "—"}</TableCell>
                <TableCell>
                  <EditableId
                    initial={p.employeeId ?? ""}
                    disabled={!canEdit}
                    placeholder={t("people.employeeId")}
                    onSave={(value) =>
                      void update(
                        { personId: p._id, employeeId: value },
                        { success: t("people.updated") },
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <EditableId
                    initial={p.genesysUserId ?? ""}
                    disabled={!canEdit}
                    placeholder={t("people.genesysId")}
                    onSave={(value) =>
                      void update(
                        { personId: p._id, genesysUserId: value },
                        { success: t("people.updated") },
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <EditableId
                    initial={p.clockodoUserId ?? ""}
                    disabled={!canEdit}
                    placeholder={t("people.clockodoId")}
                    onSave={(value) =>
                      void update(
                        { personId: p._id, clockodoUserId: value },
                        { success: t("people.updated") },
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={p.active}
                    disabled={!canEdit}
                    onChange={(e) => {
                      void update(
                        { personId: p._id, active: e.target.checked },
                        { success: t("people.updated") },
                      );
                    }}
                  />
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(p._id)}
                      className="text-danger hover:text-danger hover:bg-danger/10"
                      aria-label={t("people.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        heading={t("people.confirmDelete")}
        confirmLabel={t("people.delete")}
        onConfirm={async () => {
          if (deleteTarget) {
            await remove(
              { personId: deleteTarget },
              { success: t("people.deleted") },
            );
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
