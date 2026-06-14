"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime, formatTime, roleAtLeast, type Role } from "@/lib/format";
import { DEVICE_STATUS_CLASS, type DeviceStatus } from "@/lib/ui";
import { useMutationWithToast } from "@/lib/useMutationWithToast";

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

const STATUS_BADGE: Record<SlotStatus, string> = {
  active: "bg-ok/20 text-ok",
  used: "bg-muted/10 text-muted",
  expired: "bg-danger/20 text-danger",
  revoked: "bg-danger/20 text-danger",
};

// ── sub-components ─────────────────────────────────────────────────────────

function CreateSlotForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createSlot = useMutationWithToast(api.devices.createDeviceSlot);
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState(48);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const c = await createSlot({ label: label.trim() || undefined, expiresInHours: hours });
      if (c) setCode(c);
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!code) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (code) {
    return (
      <div className="rounded-xl border border-ok/30 bg-ok/5 p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted mb-2 font-medium">{t("devices.slots.note")}</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-2xl font-bold tracking-widest text-foreground">
                {code}
              </span>
              <button
                onClick={copyCode}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  copied
                    ? "bg-ok/30 text-ok"
                    : "bg-ok/10 text-ok hover:bg-ok/20"
                }`}
              >
                {copied ? t("devices.slots.copied") : t("devices.slots.copy")}
              </button>
            </div>
          </div>
          <button onClick={onDone} className="text-muted hover:text-foreground text-lg leading-none mt-0.5">×</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-5 mb-4">
      <h3 className="font-medium text-sm mb-4">{t("devices.slots.create")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-muted mb-1">{t("devices.slots.label")}</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("devices.slots.labelPlaceholder")}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ok/30"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">{t("devices.slots.expiry")}</label>
          <div className="flex gap-2">
            {([24, 48, 168] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  hours === h
                    ? "border-ok bg-ok/10 text-ok"
                    : "border-border bg-bg text-muted hover:border-ok/50"
                }`}
              >
                {h === 24 ? t("devices.slots.expiry24") : h === 48 ? t("devices.slots.expiry48") : t("devices.slots.expiry7d")}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={onDone}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-panel"
        >
          {t("devices.slots.cancel")}
        </button>
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-lg bg-ok/90 px-4 py-2 text-sm font-medium text-white hover:bg-ok disabled:opacity-50"
        >
          {busy ? "…" : t("devices.slots.create")}
        </button>
      </div>
    </div>
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
  const [copied, setCopied] = useState(false);
  const status = slotStatus(slot);
  const isActive = status === "active";

  function copy() {
    void navigator.clipboard.writeText(slot.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-opacity ${
        isActive ? "border-border bg-bg" : "border-border/50 bg-panel opacity-60"
      }`}
    >
      {/* Code + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`font-mono text-lg font-bold tracking-widest ${isActive ? "text-foreground" : "text-muted"}`}>
            {slot.code}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
            {t(`devices.slots.status.${status}`)}
          </span>
        </div>
        {slot.label && (
          <p className="text-sm text-muted mt-0.5 truncate">{slot.label}</p>
        )}
        <p className="text-xs text-muted mt-1">
          {status === "active"
            ? `${t("devices.slots.expires")}: ${formatRelativeTime(slot.expiresAt, lang)}`
            : status === "used"
            ? `${t("devices.slots.usedAt")}: ${formatRelativeTime(slot.usedAt!, lang)}`
            : status === "expired"
            ? `${t("devices.slots.expires")}: ${formatRelativeTime(slot.expiresAt, lang)}`
            : `${formatRelativeTime(slot.usedAt!, lang)}`}
        </p>
      </div>

      {/* Actions */}
      {isActive && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copy}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              copied
                ? "bg-ok/30 text-ok"
                : "bg-ok/10 text-ok hover:bg-ok/20"
            }`}
          >
            {copied ? t("devices.slots.copied") : t("devices.slots.copy")}
          </button>
          <button
            onClick={() =>
              void revoke(
                { slotId: slot._id as Parameters<typeof revoke>[0]["slotId"] },
                { success: t("devices.slotRevoked") },
              )
            }
            className="rounded-lg px-3 py-1.5 text-sm text-danger hover:bg-danger/10 transition-colors"
          >
            {t("devices.slots.revoke")}
          </button>
        </div>
      )}
    </div>
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

  const role = (me?.role ?? "viewer") as Role;
  const isAdmin = roleAtLeast(role, "it_admin");
  const isManager = roleAtLeast(role, "manager");

  const statusLabel: Record<string, string> = {
    pending: t("status.pending"),
    active: t("status.active"),
    disabled: t("status.disabled"),
  };

  if (devices === undefined || people === undefined) {
    return <p className="text-muted">{t("common.loading")}</p>;
  }

  return (
    <section className="space-y-8">

      {/* ── Enrollment Codes (IT admin only) ── */}
      {isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t("devices.slots.heading")}</h2>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 rounded-lg bg-ok/10 px-3 py-1.5 text-sm font-medium text-ok hover:bg-ok/20 transition-colors"
              >
                <span className="text-base leading-none">+</span>
                {t("devices.slots.create")}
              </button>
            )}
          </div>

          {showCreateForm && (
            <CreateSlotForm onDone={() => setShowCreateForm(false)} />
          )}

          {slots === undefined ? (
            <p className="text-muted text-sm">{t("common.loading")}</p>
          ) : slots.length === 0 && !showCreateForm ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <div className="text-3xl mb-2">🔑</div>
              <p className="text-muted text-sm">{t("devices.slots.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => (
                <SlotCard key={slot._id} slot={slot} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Devices table ── */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t("devices.slots.heading.devices")}</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-muted">
              <tr>
                <th className="px-4 py-3">{t("devices.host")}</th>
                <th className="px-4 py-3">{t("devices.user")}</th>
                <th className="px-4 py-3">{t("devices.status")}</th>
                <th className="px-4 py-3">{t("devices.person")}</th>
                <th className="px-4 py-3">{t("devices.lastSeen")}</th>
                {(isAdmin || isManager) && (
                  <th className="px-4 py-3">{t("devices.actions")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">
                    {t("overview.empty")}
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d._id} className="border-t border-border hover:bg-panel/50">
                    <td className="px-4 py-3 font-medium">{d.hostname}</td>
                    <td className="px-4 py-3 text-muted">{d.lastWindowsUser}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DEVICE_STATUS_CLASS[d.status as DeviceStatus]}`}
                      >
                        {statusLabel[d.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isManager ? (
                        <select
                          value={d.personId ?? ""}
                          onChange={(e) =>
                            void link(
                              {
                                deviceId: d._id,
                                personId: e.target.value
                                  ? (e.target.value as (typeof people)[number]["_id"])
                                  : null,
                              },
                              { success: t("devices.linked") },
                            )
                          }
                          className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
                        >
                          <option value="">{t("devices.none")}</option>
                          {people.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted">{d.personName ?? t("devices.none")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatTime(d.lastSeen, lang)}</td>
                    {(isAdmin || isManager) && (
                      <td className="px-4 py-3">
                        {isAdmin && (
                          <div className="flex gap-2">
                            {d.status !== "active" && (
                              <button
                                onClick={() =>
                                  void approve(
                                    { deviceId: d._id },
                                    { success: t("devices.approved") },
                                  )
                                }
                                className="rounded-md bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok hover:bg-ok/20"
                              >
                                {t("devices.approve")}
                              </button>
                            )}
                            {d.status !== "disabled" && (
                              <button
                                onClick={() =>
                                  void disable(
                                    { deviceId: d._id },
                                    { success: t("devices.disabled") },
                                  )
                                }
                                className="rounded-md bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/20"
                              >
                                {t("devices.disable")}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
