"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { roleAtLeast, type Role } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Guided "getting started" checklist for admins. Derived from the existing
 * dashboard queries (no new backend surface), it links each unfinished step to
 * the page that fixes it — so a non-technical admin can stand the system up (and
 * verify it) without a developer. Renders nothing once everything's done, or for
 * non-admins.
 */
export function SetupChecklist() {
  const { t } = useI18n();
  const me = useQuery(api.users.me);
  const isAdmin = roleAtLeast((me?.role ?? "viewer") as Role, "it_admin");

  // Admin-only queries: skip them entirely for non-admins.
  const args = isAdmin ? {} : "skip";
  const devices = useQuery(api.devices.list, args);
  const people = useQuery(api.people.list, args);
  const access = useQuery(api.access.getAccessControl, args);
  const debugPwSet = useQuery(api.settings.debugPasswordIsSet, args);

  if (!me || !isAdmin) return null;
  if (
    devices === undefined ||
    people === undefined ||
    access === undefined ||
    debugPwSet === undefined
  ) {
    return null;
  }

  const items = [
    {
      id: "access",
      done: access.adminEmails.length > 0 || access.allowedDomains.length > 0,
      href: "/settings",
    },
    {
      id: "approve",
      done: devices.some((d) => d.status === "active"),
      href: "/devices",
    },
    { id: "people", done: people.length > 0, href: "/people" },
    {
      id: "link",
      done: devices.some((d) => d.personId != null),
      href: "/devices",
    },
    { id: "debugpw", done: debugPwSet, href: "/settings" },
  ];
  const remaining = items.filter((i) => !i.done).length;
  if (remaining === 0) return null; // fully set up — don't nag.

  return (
    <Card className="animate-fade-up border-accent/30 bg-accent/5">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-fg">{t("setup.title")}</p>
          <span className="shrink-0 text-xs text-muted">
            {t("setup.remaining", { count: remaining })}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted">{t("setup.subtitle")}</p>
        <ul className="mt-3 space-y-1">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                href={i.href}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-2"
              >
                {i.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    i.done ? "text-muted line-through" : "text-fg",
                  )}
                >
                  {t(`setup.item.${i.id}`)}
                </span>
                {!i.done && (
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
