"use client";

import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigPanel } from "@/components/admin/ConfigPanel";
import { SystemPanel } from "@/components/admin/SystemPanel";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { AuditPanel } from "@/components/admin/AuditPanel";

/**
 * Admin hub: configuration, system health, users & roles, and the audit log —
 * the formerly-scattered admin pages gathered under one tab so the sidebar stays
 * short. IT-admin gated by the route (see (dash)/layout + nav minRole).
 */
export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tightest text-fg">
          {t("settings.heading")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("settings.subtitle")}</p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">{t("settings.tabs.config")}</TabsTrigger>
          <TabsTrigger value="system">{t("settings.tabs.system")}</TabsTrigger>
          <TabsTrigger value="users">{t("settings.tabs.users")}</TabsTrigger>
          <TabsTrigger value="audit">{t("settings.tabs.audit")}</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <ConfigPanel />
        </TabsContent>
        <TabsContent value="system">
          <SystemPanel />
        </TabsContent>
        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="audit">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </section>
  );
}
