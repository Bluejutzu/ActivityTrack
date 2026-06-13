"use client";

import { useEffect, useId, useRef } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const bodyId = useId();

  // Focus management + key handling while open. On open we remember what was
  // focused (the trigger), move focus into the dialog, and trap Tab within it;
  // on close we restore focus so keyboard users land back where they were.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previouslyFocused?.focus();
    };
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
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          aria-describedby={body ? bodyId : undefined}
          className="w-full max-w-sm rounded-2xl border border-border bg-panel p-6 shadow-xl animate-scale-in"
        >
          <h2 id={headingId} className="text-base font-semibold">
            {heading}
          </h2>
          {body && (
            <p id={bodyId} className="mt-1.5 text-sm text-muted">
              {body}
            </p>
          )}
          <div className="mt-5 flex gap-2 justify-end">
            <button
              ref={cancelRef}
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
