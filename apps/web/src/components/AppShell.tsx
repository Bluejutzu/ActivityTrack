"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { roleAtLeast, type Role } from "@/lib/format";
import { LangSwitcher } from "./LangSwitcher";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  labelKey: string;
  minRole: Role;
}

const NAV: NavItem[] = [
  { href: "/", labelKey: "nav.overview", minRole: "viewer" },
  { href: "/devices", labelKey: "nav.devices", minRole: "viewer" },
  { href: "/people", labelKey: "nav.people", minRole: "viewer" },
  { href: "/users", labelKey: "nav.users", minRole: "it_admin" },
  { href: "/audit", labelKey: "nav.audit", minRole: "it_admin" },
  { href: "/settings", labelKey: "nav.settings", minRole: "it_admin" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const role = (me?.role ?? "viewer") as Role;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-panel/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">{t("app.name")}</span>
          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.filter((n) => roleAtLeast(role, n.minRole)).map((n) => {
              const active =
                n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
                    active
                      ? "bg-accent/20 text-accent"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {t(n.labelKey)}
                </Link>
              );
            })}
          </nav>
          <LangSwitcher />
          <span className="hidden text-xs text-muted sm:inline">
            {me?.email} · {t(`role.${role}`)}
          </span>
          <button
            onClick={() => void signOut()}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-fg hover:border-border/80"
          >
            {t("nav.signout")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
        {t("footer.privacy")}
      </footer>
    </div>
  );
}
