"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";

export type StoreUserStatus = "pending" | "ready" | "error";

/** How many times to retry before surfacing a real failure to the UI. */
const MAX_ATTEMPTS = 5;

/**
 * Ensures a Convex `users` row exists for the signed-in Clerk account and
 * reports a status the shell can gate on. `users.store` is idempotent and
 * assigns the first account the it_admin role.
 *
 * Provisioning can fail transiently right after sign-in (the Convex auth token
 * isn't settled yet), so we retry with exponential backoff. Only a *persistent*
 * failure becomes `"error"` — at which point the UI shows a real retry
 * affordance instead of silently rendering the app with a guessed `viewer` role.
 */
export function useStoreUser(): {
  status: StoreUserStatus;
  retry: () => void;
} {
  const store = useMutation(api.users.store);
  const [status, setStatus] = useState<StoreUserStatus>("pending");
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    async function run() {
      try {
        await store();
        if (!cancelled) setStatus("ready");
      } catch (err) {
        tries += 1;
        if (tries >= MAX_ATTEMPTS) {
          if (!cancelled) {
            console.error("[useStoreUser] provisioning failed", err);
            setStatus("error");
          }
          return;
        }
        // 1s, 2s, 4s, 8s … capped at 8s.
        const delay = Math.min(1000 * 2 ** (tries - 1), 8000);
        timer = setTimeout(() => {
          if (!cancelled) void run();
        }, delay);
      }
    }

    setStatus("pending");
    void run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [store, nonce]);

  return { status, retry };
}
