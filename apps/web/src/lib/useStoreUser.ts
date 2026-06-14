"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";

/**
 * Ensures a Convex `users` row exists for the signed-in Clerk account. Runs once
 * the Convex client is authenticated; `users.store` upserts the row (and assigns
 * the first user the it_admin role). Idempotent — safe to call on every mount.
 */
export function useStoreUser() {
  const store = useMutation(api.users.store);
  useEffect(() => {
    void store().catch(() => {
      /* transient (e.g. auth not settled yet); a later mount retries */
    });
  }, [store]);
}
