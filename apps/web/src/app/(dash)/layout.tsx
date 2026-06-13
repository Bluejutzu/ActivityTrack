"use client";

import { useConvexAuth, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { LoginForm } from "@/components/LoginForm";
import { AppShell } from "@/components/AppShell";
import { SkeletonCard } from "@/components/Skeleton";
import type { ReactNode } from "react";

/**
 * Dashboard gate: unauthenticated users see the login form; authenticated
 * users get the role-aware shell. RBAC inside the app is enforced server-side
 * by Convex — these checks only control which affordances render.
 */
export default function DashLayout({ children }: { children: ReactNode }) {
  useConvexAuth();

  return (
    <>
      <AuthLoading>
        <div className="min-h-screen">
          <div className="h-12 border-b border-border bg-panel animate-pulse" />
          <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
            <div className="h-7 w-40 rounded-md bg-border/40" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
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
