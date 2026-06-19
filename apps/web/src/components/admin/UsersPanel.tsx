"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import type { GenericId } from "convex/values";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/format";
import { useMutationWithToast } from "@/lib/useMutationWithToast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES: Role[] = ["it_admin", "manager", "viewer"];

/** User role management (IT admin). Lives in the Settings hub. */
export function UsersPanel() {
  const { t } = useI18n();
  const users = useQuery(api.users.list);
  const setRole = useMutationWithToast(api.users.setRole);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Staged role change, applied only after confirmation — switching someone's
  // access level shouldn't be a one-click slip.
  const [pending, setPending] = useState<{
    userId: GenericId<"users">;
    email: string;
    role: Role;
  } | null>(null);

  if (users === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("users.email")}</TableHead>
            <TableHead>{t("users.name")}</TableHead>
            <TableHead>{t("users.role")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u._id}>
              <TableCell className="text-fg">{u.email}</TableCell>
              <TableCell className="text-muted">{u.name ?? "—"}</TableCell>
              <TableCell>
                <Select
                  value={u.role}
                  disabled={busyId === u._id}
                  onValueChange={(value) => {
                    if (value === u.role) return;
                    setPending({
                      userId: u._id,
                      email: u.email ?? "",
                      role: value as Role,
                    });
                  }}
                >
                  <SelectTrigger className="w-full min-w-[9rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`role.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={pending !== null}
        heading={t("users.confirmRole")}
        body={
          pending
            ? t("users.confirmRoleBody", {
                email: pending.email,
                role: t(`role.${pending.role}`),
              })
            : undefined
        }
        confirmLabel={t("users.confirmRoleConfirm")}
        onConfirm={async () => {
          if (pending) {
            setBusyId(pending.userId);
            await setRole(
              { userId: pending.userId, role: pending.role },
              { success: t("users.roleUpdated") },
            );
            setBusyId(null);
          }
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}
