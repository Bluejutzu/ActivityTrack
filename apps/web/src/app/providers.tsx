"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useState, type ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";

/**
 * Client-side providers: the Convex realtime client + Convex Auth (password)
 * wrap the whole app, with i18n inside so every component can translate.
 */
export function Providers({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null));

  if (!client) {
    return (
      <I18nProvider>
        <div className="mx-auto mt-24 max-w-md rounded-xl border border-border bg-panel p-6 text-center text-muted">
          <p className="text-fg">Configuration required</p>
          <p className="mt-2 text-sm">
            Set <code className="text-accent">NEXT_PUBLIC_CONVEX_URL</code> in{" "}
            <code>.env.local</code> to connect the dashboard to your Convex
            deployment.
          </p>
        </div>
      </I18nProvider>
    );
  }

  return (
    <ConvexAuthProvider client={client}>
      <I18nProvider>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </ConvexAuthProvider>
  );
}
