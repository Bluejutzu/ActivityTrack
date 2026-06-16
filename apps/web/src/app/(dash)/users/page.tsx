"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/format";
import { useMutationWithToast } from "@/lib/useMutationWithToast";
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

export default function UsersPage() {
  const { t } = useI18n();
  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "it_admin";
  const users = useQuery(api.users.list, isAdmin ? {} : "skip");
  const setRole = useMutationWithToast(api.users.setRole);
  const [busyId, setBusyId] = useState<string | null>(null);

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
                  onValueChange={async (value) => {
                    setBusyId(u._id);
                    await setRole(
                      { userId: u._id, role: value as Role },
                      { success: t("users.roleUpdated") },
                    );
                    setBusyId(null);
                  }}
                >
                  <SelectTrigger className="w-44">
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
    </Card>
  );
}
