import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/60",
  {
    variants: {
      variant: {
        default: "border-accent/30 bg-accent/15 text-accent",
        ok: "border-ok/30 bg-ok/15 text-ok",
        warn: "border-warn/30 bg-warn/15 text-warn",
        danger: "border-danger/30 bg-danger/15 text-danger",
        muted: "border-border bg-panel-2 text-muted",
        outline: "border-border text-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
