"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime, roleAtLeast, type Role } from "@/lib/format";
import { useMutationWithToast } from "@/lib/useMutationWithToast";
import { InfoTip } from "@/components/InfoTip";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEVICE_VARIANT: Record<string, "ok" | "warn" | "danger"> = {
  active: "ok",
  pending: "warn",
  disabled: "danger",
};

// ── page ───────────────────────────────────────────────────────────────────

export default function DevicesPage() {
  const { t, lang } = useI18n();
  const me = useQuery(api.users.me);
  const devices = useQuery(api.devices.list);
  const people = useQuery(api.people.list);

  const approve = useMutationWithToast(api.devices.approve);
  const disable = useMutationWithToast(api.devices.disable);
  const link = useMutationWithToast(api.devices.link);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const role = (me?.role ?? "viewer") as Role;
  const isAdmin = roleAtLeast(role, "it_admin");
  const isManager = roleAtLeast(role, "manager");

  const statusLabel: Record<string, string> = {
    pending: t("status.pending"),
    active: t("status.active"),
    disabled: t("status.disabled"),
  };

  // Filter the table by status and a free-text match on hostname / windows
  // user / linked person, so a larger fleet stays scannable.
  const visibleDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (devices ?? []).filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      return [d.hostname, d.lastWindowsUser, d.personName]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [devices, statusFilter, search]);

  if (devices === undefined || people === undefined) {
    return <p className="text-muted">{t("common.loading")}</p>;
  }

  return (
    <section className="space-y-8">
      {/* ── Devices table ── */}
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tightest text-fg">
            {t("devices.slots.heading.devices")}
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              placeholder={t("devices.filter.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-48"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("devices.filter.all")}</SelectItem>
                <SelectItem value="active">{t("status.active")}</SelectItem>
                <SelectItem value="pending">{t("status.pending")}</SelectItem>
                <SelectItem value="disabled">
                  {t("status.disabled")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("devices.host")}</TableHead>
                <TableHead>{t("devices.user")}</TableHead>
                <TableHead>{t("devices.status")}</TableHead>
                <TableHead>{t("devices.person")}</TableHead>
                <TableHead>{t("devices.lastSeen")}</TableHead>
                {(isAdmin || isManager) && (
                  <TableHead>{t("devices.actions")}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleDevices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted"
                  >
                    {t("overview.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                visibleDevices.map((d) => (
                  <TableRow key={d._id}>
                    <TableCell className="font-medium text-fg">
                      <Link
                        href={`/timeline/${encodeURIComponent(d.deviceId)}`}
                        className="text-fg transition-colors hover:text-accent"
                      >
                        {d.hostname}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted">
                      {d.lastWindowsUser}
                    </TableCell>
                    <TableCell>
                      <InfoTip text={t(`help.deviceStatus.${d.status}`)}>
                        <Badge variant={DEVICE_VARIANT[d.status] ?? "muted"}>
                          {statusLabel[d.status]}
                        </Badge>
                      </InfoTip>
                    </TableCell>
                    <TableCell>
                      {isManager ? (
                        <Select
                          value={d.personId ?? "__none__"}
                          onValueChange={(value) =>
                            void link(
                              {
                                deviceId: d._id,
                                personId:
                                  value === "__none__"
                                    ? null
                                    : (value as (typeof people)[number]["_id"]),
                              },
                              { success: t("devices.linked") },
                            )
                          }
                        >
                          <SelectTrigger className="min-w-[8rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              {t("devices.none")}
                            </SelectItem>
                            {people.map((p) => (
                              <SelectItem key={p._id} value={p._id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted">
                          {d.personName ?? t("devices.none")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {formatRelativeTime(d.lastSeen, lang)}
                    </TableCell>
                    {(isAdmin || isManager) && (
                      <TableCell>
                        {isAdmin && (
                          <div className="flex gap-2">
                            {d.status !== "active" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="text-ok"
                                onClick={() =>
                                  void approve(
                                    { deviceId: d._id },
                                    { success: t("devices.approved") },
                                  )
                                }
                              >
                                {t("devices.approve")}
                              </Button>
                            )}
                            {d.status !== "disabled" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="text-danger"
                                onClick={() =>
                                  void disable(
                                    { deviceId: d._id },
                                    { success: t("devices.disabled") },
                                  )
                                }
                              >
                                {t("devices.disable")}
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </section>
  );
}
