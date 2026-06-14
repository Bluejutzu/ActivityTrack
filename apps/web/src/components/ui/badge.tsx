import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/60",
  {
    variants: {
      variant: {
        default: "bg-accent/20 text-accent",
        ok: "bg-ok/20 text-ok",
        warn: "bg-warn/20 text-warn",
        danger: "bg-danger/20 text-danger",
        muted: "bg-muted/10 text-muted",
        outline: "border border-border text-fg",
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
