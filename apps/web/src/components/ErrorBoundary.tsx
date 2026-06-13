"use client";

import { Component, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";

interface BoundaryProps {
  children: ReactNode;
  fallback: (reset: () => void) => ReactNode;
  onError?: (error: Error, componentStack: string) => void;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in its subtree so one broken page can't blank
 * the whole dashboard. React only surfaces these to class components, hence
 * this is a class; the user-facing wrapper below adds reporting + i18n.
 */
class ErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    this.props.onError?.(error, info.componentStack ?? "");
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.reset);
    return this.props.children;
  }
}

/**
 * Dashboard error boundary: reports the crash to the central event log (so IT
 * sees it on the System Health page) and shows a calm, localized fallback with
 * a retry — never a blank screen or a raw stack trace.
 */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const report = useMutation(api.events.logFromDashboard);

  return (
    <ErrorBoundaryInner
      onError={(error, componentStack) => {
        // Fire-and-forget; a reporting failure must not loop back into the UI.
        void report({
          message: error.message || String(error),
          context: componentStack.slice(0, 2000),
        }).catch(() => {});
      }}
      fallback={(reset) => (
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-danger/30 bg-danger/5 p-6 text-center animate-fade-up">
          <div className="mb-2 text-3xl">⚠️</div>
          <h2 className="text-lg font-semibold text-fg">
            {t("errorBoundary.title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("errorBoundary.body")}</p>
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent/80 active:scale-95"
          >
            {t("errorBoundary.retry")}
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundaryInner>
  );
}
