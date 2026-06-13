"use client";

import { useConvexAuth } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { LoginForm } from "@/components/LoginForm";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import type { ReactNode } from "react";

/**
 * Dashboard gate: unauthenticated users see the login form; authenticated
 * users get the role-aware shell. RBAC inside the app is enforced server-side
 * by Convex — these checks only control which affordances render.
 */
export default function DashLayout({ children }: { children: ReactNode }) {
  // Touch the hook so the bundle wires up auth state subscriptions eagerly.
  useConvexAuth();
  const { t } = useI18n();

  return (
    <>
      <AuthLoading>
        <div className="mt-24 text-center text-muted">{t("common.loading")}</div>
      </AuthLoading>
      <Unauthenticated>
        <LoginForm />
      </Unauthenticated>
      <Authenticated>
        <AppShell>{children}</AppShell>
      </Authenticated>
    </>
  );
}
