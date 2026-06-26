"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  CalendarRange,
  HelpCircle,
  LayoutDashboard,
  Menu,
  MonitorSmartphone,
  MoreHorizontal,
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
  /** Shown in the mobile bottom tab bar (the primary destinations). */
  primary?: boolean;
}

const NAV: NavItem[] = [
  {
    href: "/",
    labelKey: "nav.overview",
    minRole: "viewer",
    icon: LayoutDashboard,
    primary: true,
  },
  {
    href: "/devices",
    labelKey: "nav.devices",
    minRole: "viewer",
    icon: MonitorSmartphone,
    primary: true,
  },
  {
    href: "/people",
    labelKey: "nav.people",
    minRole: "viewer",
    icon: Users,
    primary: true,
  },
  {
    href: "/reports",
    labelKey: "nav.reports",
    minRole: "viewer",
    icon: CalendarRange,
    primary: true,
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    minRole: "it_admin",
    icon: Settings,
  },
  { href: "/help", labelKey: "nav.help", minRole: "viewer", icon: HelpCircle },
];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

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
        const active = isActive(n.href, pathname);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[background-color,color] duration-150",
              active
                ? "bg-panel text-fg shadow-soft"
                : "text-muted hover:bg-panel/60 hover:text-fg",
            )}
          >
            {/* Left highlight bar on the active route. */}
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-opacity duration-200",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0 transition-colors",
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
      <span className="brand-gradient grid h-9 w-9 place-items-center rounded-xl text-accent-fg shadow-glow transition-transform duration-150 group-hover:scale-105">
        <Activity className="h-[18px] w-[18px]" />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[16px] font-bold tracking-tight text-fg">
          {t("app.name")}
        </span>
        <span className="mt-1 truncate text-[11px] text-muted">
          {t("app.tagline")}
        </span>
      </span>
    </Link>
  );
}

/** The mobile bottom tab bar — thumb-reachable, glass, safe-area aware. */
function BottomNav({
  items,
  pathname,
  onMore,
}: {
  items: NavItem[];
  pathname: string;
  onMore: () => void;
}) {
  const { t } = useI18n();
  const primary = items.filter((n) => n.primary).slice(0, 4);
  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t("nav.overview")}
    >
      {primary.map((n) => {
        const active = isActive(n.href, pathname);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-muted",
            )}
          >
            <Icon className="h-[22px] w-[22px]" />
            <span className="max-w-full truncate px-1">{t(n.labelKey)}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted transition-colors hover:text-fg"
      >
        <MoreHorizontal className="h-[22px] w-[22px]" />
        <span>{t("nav.more")}</span>
      </button>
    </nav>
  );
}

/** Full-screen placeholder shown while the user row is being provisioned. */
function BootstrapSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="glass h-14 border-b" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <div className="h-7 w-40 rounded-md bg-panel-2/60" />
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
      <div className="max-w-md rounded-2xl border border-danger/30 bg-danger/5 p-8 text-center shadow-soft animate-fade-up">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-danger/30 bg-danger/10 text-2xl">
          ⚠
        </div>
        <h2 className="font-display text-xl font-medium tracking-tight text-fg">
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

function UserCard({
  email,
  role,
  theme,
}: {
  email: string | undefined;
  role: Role;
  theme: "light" | "dark";
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-panel/70 p-2.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-fg">{email}</p>
        <Badge variant="outline" className="mt-1.5">
          {t(`role.${role}`)}
        </Badge>
      </div>
      <div className="shrink-0">
        <UserButton
          afterSignOutUrl="/"
          appearance={{ variables: CLERK_VARS[theme] }}
        />
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

  const { status, errorCode, retry } = useStoreUser();

  if (status === "error") {
    return <AuthErrorPanel onRetry={retry} errorCode={errorCode} />;
  }
  if (status !== "ready" || me === undefined || me === null) {
    return <BootstrapSkeleton />;
  }

  const role = me.role as Role;
  const items = NAV.filter((n) => roleAtLeast(role, n.minRole));
  const current = NAV.find((n) => isActive(n.href, pathname));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Desktop sidebar — the warm rail. Cards in the content plane lift above it. */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-bg-2 p-3.5 lg:flex">
        <div className="px-1.5 pb-7 pt-1.5">
          <Brand />
        </div>
        <NavLinks items={items} pathname={pathname} />
        <div className="mt-auto pt-4">
          <UserCard email={me.email} role={role} theme={theme} />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        {/* Top bar — quiet glass chrome. min-w-0 + truncate keep it from
            overflowing on small screens; controls never shrink. */}
        <header className="glass sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[17rem] border-border bg-bg-2 p-3.5"
            >
              <div className="px-1.5 pb-6 pt-1">
                <Brand />
              </div>
              <NavLinks
                items={items}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
              <div className="mt-6 border-t border-border pt-4">
                <UserCard email={me.email} role={role} theme={theme} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col leading-none">
            <h1 className="truncate text-lg font-bold tracking-tight text-fg">
              {current ? t(current.labelKey) : t("app.name")}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <LangSwitcher />
            <div className="lg:hidden">
              <UserButton
                afterSignOutUrl="/"
                appearance={{ variables: CLERK_VARS[theme] }}
              />
            </div>
          </div>
        </header>

        {/* pb-24 on mobile leaves room above the bottom tab bar. */}
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:py-8 lg:pb-8">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="mx-auto hidden w-full max-w-6xl items-center gap-2 px-4 py-8 text-xs text-muted sm:px-6 lg:flex">
          <span className="h-1 w-1 rounded-full bg-accent/60" />
          {t("footer.privacy")}
        </footer>
      </div>

      <BottomNav
        items={items}
        pathname={pathname}
        onMore={() => setMobileOpen(true)}
      />
    </div>
  );
}
