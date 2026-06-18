"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useState, type ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";

/**
 * Client-side providers. Clerk owns identity; Convex verifies the Clerk JWT via
 * `ConvexProviderWithClerk`. i18n + toasts live inside so every component can
 * translate and surface errors. The Clerk publishable key is read from
 * `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` automatically.
 */
export function Providers({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null));

  if (!client) {
    return (
      <ThemeProvider>
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
      </ThemeProvider>
    );
  }

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={client} useAuth={useAuth}>
        <ThemeProvider>
          <I18nProvider>
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
