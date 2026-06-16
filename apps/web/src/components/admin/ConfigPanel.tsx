"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { CheckCircle2, KeyRound, Loader2, SlidersHorizontal } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/useToast";
import { useActionWithToast } from "@/lib/useActionWithToast";
import { useMutationWithToast } from "@/lib/useMutationWithToast";
import { Reveal } from "@/components/motion/Reveal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/** A single labelled numeric config field with a unit suffix. */
function NumberField({
  label,
  hint,
  value,
  unit,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | "";
  unit: string;
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-fg">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="w-32"
        />
        <span className="text-sm text-muted">{unit}</span>
      </div>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

/** Operational configuration + tracker debug password (IT admin). */
export function ConfigPanel() {
  const { t } = useI18n();
  const toast = useToast();

  // ── Operational config ────────────────────────────────────────────────
  const config = useQuery(api.settings.getConfig);
  const setConfig = useMutationWithToast(api.settings.setConfig);

  const [inactivity, setInactivity] = useState<number | "">("");
  const [offline, setOffline] = useState<number | "">("");
  const [retention, setRetention] = useState<number | "">("");
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    if (!config) return;
    setInactivity(config.inactivityThresholdSeconds);
    setOffline(config.offlineThresholdSeconds);
    setRetention(config.retentionDays);
  }, [config]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (inactivity === "" || offline === "" || retention === "") {
      toast(t("settings.config.invalid"), "warn");
      return;
    }
    setSavingCfg(true);
    await setConfig(
      {
        inactivityThresholdSeconds: inactivity,
        offlineThresholdSeconds: offline,
        retentionDays: retention,
      },
      { success: t("settings.config.saved") },
    );
    setSavingCfg(false);
  }

  // ── Tracker debug password ────────────────────────────────────────────
  const isSet = useQuery(api.settings.debugPasswordIsSet);
  const setDebugPassword = useActionWithToast(api.settings.setDebugPassword);
  const [pw, setPw] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(id);
  }, [saved]);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    if (pw.length < 6) {
      toast(t("settings.debugPw.tooShort"), "warn");
      return;
    }
    setBusy(true);
    const result = await setDebugPassword(
      { password: pw },
      { success: t("settings.debugPw.saved") },
    );
    setBusy(false);
    if (result !== undefined) {
      setPw("");
      setSaved(true);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Operational thresholds */}
      <Card className="animate-fade-up">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">
              {t("settings.config.heading")}
            </CardTitle>
          </div>
          <CardDescription>{t("settings.config.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {config === undefined ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <form onSubmit={saveConfig} className="space-y-5">
              <NumberField
                label={t("settings.config.inactivity")}
                hint={t("settings.config.inactivityHint")}
                value={inactivity}
                unit={t("settings.config.seconds")}
                onChange={setInactivity}
              />
              <NumberField
                label={t("settings.config.offline")}
                hint={t("settings.config.offlineHint")}
                value={offline}
                unit={t("settings.config.seconds")}
                onChange={setOffline}
              />
              <NumberField
                label={t("settings.config.retention")}
                hint={t("settings.config.retentionHint")}
                value={retention}
                unit={t("settings.config.days")}
                onChange={setRetention}
              />
              <Button type="submit" disabled={savingCfg}>
                {savingCfg && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("settings.config.save")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Tracker debug password */}
      <Card className="animate-fade-up">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent">
              <KeyRound className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">
              {t("settings.debugPw.heading")}
            </CardTitle>
          </div>
          <CardDescription>{t("settings.debugPw.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            {isSet === undefined ? (
              <Skeleton className="h-5 w-32" />
            ) : isSet ? (
              <Badge variant="ok">{t("settings.debugPw.set")}</Badge>
            ) : (
              <Badge variant="muted">{t("settings.debugPw.unset")}</Badge>
            )}
          </div>

          <form onSubmit={savePassword} className="flex gap-2">
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t("settings.debugPw.new")}
              className="flex-1"
            />
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("settings.debugPw.save")}
            </Button>
          </form>

          <Reveal show={saved}>
            <p className="flex items-center gap-1.5 text-sm text-ok">
              <CheckCircle2 className="h-4 w-4" />
              {t("settings.debugPw.saved")}
            </p>
          </Reveal>
        </CardContent>
      </Card>
    </div>
  );
}
