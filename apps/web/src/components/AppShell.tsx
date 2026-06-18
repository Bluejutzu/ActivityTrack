"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  CalendarRange,
  LayoutDashboard,
  Menu,
  MonitorSmartphone,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { CLERK_VARS } from "@/lib/clerkAppearance";
import { useStoreUser } from "@/lib/useStoreUser";
import { roleAtLeast, type Role } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LangSwitcher } from "./LangSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { PageTransition } from "./PageTransition";
import { SkeletonCard } from "@/components/Skeleton";
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

// Trimmed to four clear destinations. The former Live-Status folds into the
// Overview/timeline; Health, Users and Audit are sub-tabs inside Settings.
const NAV: NavItem[] = [
  {
    href: "/",
    labelKey: "nav.overview",
    minRole: "viewer",
    icon: LayoutDashboard,
  },
  {
    href: "/devices",
    labelKey: "nav.devices",
    minRole: "viewer",
    icon: MonitorSmartphone,
  },
  { href: "/people", labelKey: "nav.people", minRole: "viewer", icon: Users },
  {
    href: "/reports",
    labelKey: "nav.reports",
    minRole: "viewer",
    icon: CalendarRange,
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    minRole: "it_admin",
    icon: Settings,
  },
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
    <nav className="flex flex-col gap-0.5">
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
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
              active
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-panel-2 hover:text-fg",
            )}
          >
            {/* Signal indicator bar on the active route. */}
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-200",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-accent" : "text-muted group-hover:text-fg",
              )}
            />
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
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white shadow-sm">
        <Activity className="h-[18px] w-[18px]" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tightest text-fg">
          {t("app.name")}
        </span>
        <span className="mt-1 text-[11px] text-muted">{t("app.tagline")}</span>
      </span>
    </Link>
  );
}

/** Full-screen placeholder shown while the user row is being provisioned. */
function BootstrapSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="h-14 border-b border-border bg-panel/60 animate-pulse" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <div className="h-7 w-40 rounded-md bg-border/40" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

const ERROR_CODE_MESSAGES: Record<string, string> = {
  "auth.not_allowed": "auth.error.not_allowed",
  "auth.domain_not_allowed": "auth.error.domain_not_allowed",
};

/** Shown when provisioning fails for real (after retries) — calm, with retry. */
function AuthErrorPanel({
  onRetry,
  errorCode,
}: {
  onRetry: () => void;
  errorCode: string | null;
}) {
  const { t } = useI18n();
  const bodyKey =
    (errorCode && ERROR_CODE_MESSAGES[errorCode]) ?? "auth.error.body";
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="max-w-md rounded-xl border border-danger/30 bg-danger/5 p-8 text-center shadow-soft animate-fade-up">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-danger/30 bg-danger/10 text-2xl">
          ⚠
        </div>
        <h2 className="font-display text-lg font-semibold tracking-tightest text-fg">
          {t("auth.error.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t(bodyKey)}</p>
        <Button className="mt-5" onClick={onRetry}>
          {t("auth.error.retry")}
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useTheme();

  // Provision (and access-gate) the Convex user row once authenticated.
  const { status, errorCode, retry } = useStoreUser();

  // Gate: never render the role-aware shell until the user row is provisioned
  // AND loaded. A provisioning failure (e.g. not on the access allowlist)
  // surfaces a specific message instead of silently rendering an empty app.
  if (status === "error") {
    return <AuthErrorPanel onRetry={retry} errorCode={errorCode} />;
  }
  if (status !== "ready" || me === undefined || me === null) {
    return <BootstrapSkeleton />;
  }

  const role = me.role as Role;
  const items = NAV.filter((n) => roleAtLeast(role, n.minRole));
  const current = NAV.find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-bg-2 p-4 lg:flex">
        <div className="px-1 pb-7 pt-1">
          <Brand />
        </div>
        <NavLinks items={items} pathname={pathname} />
        <div className="mt-auto space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs text-fg">{me.email}</p>
              <Badge variant="outline" className="mt-1.5">
                {t(`role.${role}`)}
              </Badge>
            </div>
            <UserButton
              afterSignOutUrl="/"
              appearance={{ variables: CLERK_VARS[theme] }}
            />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg-2/85 px-4 py-3 backdrop-blur-md sm:px-6">
          {/* Mobile nav trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 border-border bg-panel p-4"
            >
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

          <div className="flex flex-1 flex-col leading-none">
            <h1 className="text-base font-semibold tracking-tightest text-fg">
              {current ? t(current.labelKey) : t("app.name")}
            </h1>
          </div>

          <ThemeToggle />
          <LangSwitcher />
          <div className="lg:hidden">
            <UserButton
              afterSignOutUrl="/"
              appearance={{ variables: CLERK_VARS[theme] }}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-8 text-xs text-muted sm:px-6">
          <span className="h-1 w-1 rounded-full bg-accent/60" />
          {t("footer.privacy")}
        </footer>
      </div>
    </div>
  );
}
