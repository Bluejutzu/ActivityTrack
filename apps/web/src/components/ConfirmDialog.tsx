"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

interface Props {
  open: boolean;
  heading: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  heading,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-sm rounded-2xl border border-border bg-panel p-6 shadow-xl animate-scale-in"
        >
          <h2 className="text-base font-semibold">{heading}</h2>
          {body && <p className="mt-1.5 text-sm text-muted">{body}</p>}
          <div className="mt-5 flex gap-2 justify-end">
            <button
              onClick={onCancel}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors duration-150 hover:text-fg"
            >
              {t("people.cancel")}
            </button>
            <button
              onClick={onConfirm}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-danger/80"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
