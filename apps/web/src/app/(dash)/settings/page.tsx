"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/useToast";
import { useActionWithToast } from "@/lib/useActionWithToast";
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

export default function SettingsPage() {
  const { t } = useI18n();
  const toast = useToast();
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

  async function onSave(e: React.FormEvent) {
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
    <section className="max-w-lg">
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

          <form onSubmit={onSave} className="flex gap-2">
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
    </section>
  );
}
