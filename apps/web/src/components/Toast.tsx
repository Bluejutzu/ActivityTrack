"use client";

import { useState, useCallback, type ReactNode } from "react";
import { ToastContext, type ToastItem, type ToastVariant } from "@/lib/useToast";

let nextId = 0;

const VARIANT_CLASS: Record<ToastVariant, string> = {
  ok: "bg-ok/10 border-ok/30 text-ok",
  warn: "bg-warn/10 border-warn/30 text-warn",
  danger: "bg-danger/10 border-danger/30 text-danger",
};

const DOT_CLASS: Record<ToastVariant, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "ok") => {
    const id = ++nextId;
    setItems((prev) => [...prev, { id, message, variant, exiting: false }]);

    setTimeout(() => {
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
      );
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 200);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ items, toast }}>
      {children}
      {items.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
          role="status"
          aria-live="polite"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-lg ${
                VARIANT_CLASS[item.variant]
              } ${item.exiting ? "animate-toast-out" : "animate-toast-in"}`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[item.variant]}`}
              />
              {item.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
