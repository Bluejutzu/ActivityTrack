"use client";

import { useEffect, useState } from "react";

const NEW_URL = "https://intern.advantisgroup.de/admin/activity";
const REDIRECT_DELAY = 10;

export default function NotFound() {
  const [seconds, setSeconds] = useState(REDIRECT_DELAY);

  useEffect(() => {
    if (seconds <= 0) {
      window.location.replace(NEW_URL);
      return;
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-panel p-8 shadow-xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-warn/10 p-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-warn"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-fg tracking-tight">
          This dashboard has moved
        </h1>
        <p className="mt-3 text-muted leading-relaxed">
          The ActivityTrack dashboard is no longer available at this location.
          It has been migrated to the Advantis Group internal portal.
        </p>

        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 px-5 py-4 text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-muted mb-1">
            New location
          </p>
          <a
            href={NEW_URL}
            className="text-accent font-medium break-all hover:underline underline-offset-4 transition-opacity hover:opacity-80"
          >
            intern.advantisgroup.de/admin/activity
          </a>
        </div>

        <div className="mt-6">
          <a
            href={NEW_URL}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 active:opacity-80"
          >
            Go to new location
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        </div>

        <p className="mt-5 text-sm text-muted">
          Redirecting automatically in{" "}
          <span className="tabular-nums font-medium text-fg">{seconds}</span>
          {seconds === 1 ? " second" : " seconds"}&hellip;
        </p>

        <p className="mt-8 text-xs text-muted/60 border-t border-border-soft pt-5">
          Bookmarks and integrations pointing to this URL will no longer work.
          Please update them to the new address above.
        </p>
      </div>
    </div>
  );
}
