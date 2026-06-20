"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Check, Copy, KeyRound, Plus, X } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime, roleAtLeast, type Role } from "@/lib/format";
import { useMutationWithToast } from "@/lib/useMutationWithToast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InfoTip } from "@/components/InfoTip";
import { Collapse } from "@/components/motion/Collapse";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { MOTION } from "@/components/motion/motion-tokens";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// ── helpers ────────────────────────────────────────────────────────────────

type SlotStatus = "active" | "used" | "expired" | "revoked";

function slotStatus(slot: {
  usedAt?: number;
  usedByDeviceId?: string;
  expiresAt: number;
}): SlotStatus {
  if (slot.usedByDeviceId === "__revoked__") return "revoked";
  if (slot.usedAt !== undefined) return "used";
  if (slot.expiresAt < Date.now()) return "expired";
  return "active";
}

const SLOT_VARIANT: Record<SlotStatus, "ok" | "muted" | "danger"> = {
  active: "ok",
  used: "muted",
  expired: "danger",
  revoked: "danger",
};

const DEVICE_VARIANT: Record<string, "ok" | "warn" | "danger"> = {
  active: "ok",
  pending: "warn",
  disabled: "danger",
};

/** Small copy-to-clipboard button with a transient "copied" state. */
function CopyButton({ value }: { value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? (
        <Check className="h-4 w-4 text-ok" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {copied ? t("devices.slots.copied") : t("devices.slots.copy")}
    </Button>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function CreateSlotForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createSlot = useMutationWithToast(api.devices.createDeviceSlot);
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState(48);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    try {
      const c = await createSlot({
        label: label.trim() || undefined,
        expiresInHours: hours,
      });
      if (c) setCode(c);
    } finally {
      setBusy(false);
    }
  }

  // Fade between the form and the generated-code confirmation (keyed on state)
  // so the swap reads as one surface changing, not a card popping out of nowhere.
  // The surrounding <Collapse> (in the page) animates the open/close height.
  return (
    <motion.div
      key={code ? "code" : "form"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
    >
      {code ? (
        <>
          <Card className="mb-4 border-ok/30 bg-ok/5">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="mb-2 text-sm font-medium text-muted">
                  {t("devices.slots.note")}
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-bold tracking-widest text-fg">
                    {code}
                  </span>
                  <CopyButton value={code} />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDone}
                aria-label="close"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("devices.slots.label")}</Label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t("devices.slots.labelPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("devices.slots.expiry")}</Label>
                  <div className="flex gap-2">
                    {([24, 48, 168] as const).map((h) => (
                      <Button
                        key={h}
                        type="button"
                        variant={hours === h ? "default" : "secondary"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setHours(h)}
                      >
                        {h === 24
                          ? t("devices.slots.expiry24")
                          : h === 48
                            ? t("devices.slots.expiry48")
                            : t("devices.slots.expiry7d")}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={onDone}>
                  {t("devices.slots.cancel")}
                </Button>
                <Button onClick={() => void submit()} disabled={busy}>
                  {t("devices.slots.create")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}

function SlotCard({
  slot,
}: {
  slot: {
    _id: string;
    code: string;
    label?: string;
    expiresAt: number;
    usedAt?: number;
    usedByDeviceId?: string;
    createdAt: number;
  };
}) {
  const { t, lang } = useI18n();
  const revoke = useMutationWithToast(api.devices.revokeSlot);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const status = slotStatus(slot);
  const isActive = status === "active";

  return (
    <Card className={isActive ? "" : "opacity-60"}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`font-mono text-lg font-bold tracking-widest ${
                isActive ? "text-fg" : "text-muted"
              }`}
            >
              {slot.code}
            </span>
            <Badge variant={SLOT_VARIANT[status]}>
              {t(`devices.slots.status.${status}`)}
            </Badge>
          </div>
          {slot.label && (
            <p className="mt-0.5 truncate text-sm text-muted">{slot.label}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            {status === "used" || status === "revoked"
              ? `${t("devices.slots.usedAt")}: ${formatRelativeTime(slot.usedAt!, lang)}`
              : `${t("devices.slots.expires")}: ${formatRelativeTime(slot.expiresAt, lang)}`}
          </p>
        </div>

        {isActive && (
          <div className="flex shrink-0 items-center gap-2">
            <CopyButton value={slot.code} />
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => setConfirmOpen(true)}
            >
              {t("devices.slots.revoke")}
            </Button>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        heading={t("devices.slots.confirmRevoke")}
        confirmLabel={t("devices.slots.revoke")}
        onConfirm={async () => {
          await revoke(
            { slotId: slot._id as Parameters<typeof revoke>[0]["slotId"] },
            { success: t("devices.slotRevoked") },
          );
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function DevicesPage() {
  const { t, lang } = useI18n();
  const me = useQuery(api.users.me);
  const devices = useQuery(api.devices.list);
  const people = useQuery(api.people.list);
  const slots = useQuery(api.devices.listSlots);

  const approve = useMutationWithToast(api.devices.approve);
  const disable = useMutationWithToast(api.devices.disable);
  const link = useMutationWithToast(api.devices.link);

  const [showCreateForm, setShowCreateForm] = useState(false);
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
      {/* ── Enrollment Codes (IT admin only) ── */}
      {isAdmin && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tightest text-fg">
              {t("devices.slots.heading")}
            </h2>
            {!showCreateForm && (
              <Button size="sm" onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4" />
                {t("devices.slots.create")}
              </Button>
            )}
          </div>

          <Collapse show={showCreateForm}>
            <CreateSlotForm onDone={() => setShowCreateForm(false)} />
          </Collapse>

          {slots === undefined ? (
            <p className="text-sm text-muted">{t("common.loading")}</p>
          ) : slots.length === 0 && !showCreateForm ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <KeyRound className="h-7 w-7 text-muted" />
                <p className="text-sm text-muted">{t("devices.slots.empty")}</p>
              </CardContent>
            </Card>
          ) : (
            <Stagger className="space-y-2">
              {slots.map((slot, i) => (
                <StaggerItem key={slot._id} index={i}>
                  <SlotCard slot={slot} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      )}

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
