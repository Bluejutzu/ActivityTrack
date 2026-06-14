"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  HeartPulse,
  LayoutDashboard,
  Menu,
  MonitorSmartphone,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useStoreUser } from "@/lib/useStoreUser";
import { roleAtLeast, type Role } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LangSwitcher } from "./LangSwitcher";
import { PageTransition } from "./PageTransition";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  labelKey: string;
  minRole: Role;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/", labelKey: "nav.overview", minRole: "viewer", icon: LayoutDashboard },
  { href: "/devices", labelKey: "nav.devices", minRole: "viewer", icon: MonitorSmartphone },
  { href: "/people", labelKey: "nav.people", minRole: "viewer", icon: Users },
  { href: "/health", labelKey: "nav.health", minRole: "viewer", icon: HeartPulse },
  { href: "/users", labelKey: "nav.users", minRole: "it_admin", icon: ShieldCheck },
  { href: "/audit", labelKey: "nav.audit", minRole: "it_admin", icon: ScrollText },
  { href: "/settings", labelKey: "nav.settings", minRole: "it_admin", icon: Settings },
];

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((n) => {
        const active =
          n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
              active
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-panel-2 hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {t(n.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent">
        <Activity className="h-4 w-4" />
      </span>
      <span className="font-semibold text-fg">{t("app.name")}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const role = (me?.role ?? "viewer") as Role;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Provision the Convex user row (and first-user it_admin) once authenticated.
  useStoreUser();

  const items = NAV.filter((n) => roleAtLeast(role, n.minRole));
  const current = NAV.find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-panel/60 p-4 lg:flex">
        <div className="px-1 pb-6">
          <Brand />
        </div>
        <NavLinks items={items} pathname={pathname} />
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-fg">{me?.email}</p>
            <Badge variant="outline" className="mt-1">
              {t(`role.${role}`)}
            </Badge>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-panel/80 px-4 py-3 backdrop-blur-sm">
          {/* Mobile nav trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <div className="px-1 pb-6">
                <Brand />
              </div>
              <NavLinks
                items={items}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <h1 className="flex-1 text-base font-semibold text-fg">
            {current ? t(current.labelKey) : t("app.name")}
          </h1>

          <LangSwitcher />
          <div className="lg:hidden">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-muted">
          {t("footer.privacy")}
        </footer>
      </div>
    </div>
  );
}
