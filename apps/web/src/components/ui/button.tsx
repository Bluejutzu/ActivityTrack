import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap rounded-lg font-medium",
    // Animate only cheap properties; press feedback is a quick scale (per the
    // animation guidance: ~0.97, fast).
    "transition-[background-color,border-color,color,box-shadow,filter,transform] duration-150 ease-out",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Brand blurple gradient — the one primary action on a screen.
        // `default` and `primary` are aliases (back-compat + the new naming).
        default: "btn-primary font-semibold",
        primary: "btn-primary font-semibold",
        secondary:
          "border border-border bg-bg-2 text-fg hover:bg-panel-2 hover:border-border",
        ghost: "text-muted hover:bg-panel-2 hover:text-fg",
        outline:
          "border border-border bg-bg-2 text-fg hover:border-accent/50 hover:bg-panel-2",
        // `destructive` and `danger` are aliases.
        destructive: "bg-danger text-white hover:brightness-105",
        danger: "bg-danger text-white hover:brightness-105",
        "danger-ghost": "text-danger hover:bg-danger/10",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-xs [&_svg]:size-3.5",
        default: "h-9 px-4 py-2 text-sm [&_svg]:size-4",
        md: "h-9 px-4 py-2 text-sm [&_svg]:size-4",
        lg: "h-11 rounded-xl px-6 text-sm [&_svg]:size-4",
        icon: "h-9 w-9 [&_svg]:size-4",
        "icon-sm": "h-8 w-8 rounded-md [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
