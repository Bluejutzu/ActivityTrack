"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/lib/theme";

/**
 * shadcn Sonner toaster, wired to the app's own ThemeProvider (`@/lib/theme`)
 * instead of next-themes. Colours map onto our `--c-*` tokens so toasts match
 * the dashboard in light and dark; `richColors` tints success/warning/error.
 */
export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      richColors
      closeButton
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-panel group-[.toaster]:text-fg group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted",
          actionButton:
            "group-[.toast]:bg-accent group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-panel-2 group-[.toast]:text-muted",
        },
      }}
      {...props}
    />
  );
}
