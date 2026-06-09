"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * shadcn-style Button. The host UI is black/white; primary actions use the
 * `gold` variant which reuses the app's existing metallic gold button look
 * (.game-show-btn from globals.css).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        // Metallic gold — primary actions (Start, Create room).
        gold: "game-show-btn relative z-0 text-[#14110a]",
        // Neutral outline on black.
        outline: "border border-white/20 bg-transparent text-white/90 hover:bg-white/10 hover:border-white/35",
        // Subtle filled.
        secondary: "bg-white/10 text-white/90 hover:bg-white/15",
        // Quiet text button.
        ghost: "text-white/70 hover:bg-white/10 hover:text-white",
        // Destructive (end / remove / kick).
        destructive: "bg-red-600/90 text-red-50 hover:bg-red-600 border border-red-400/30",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-3.5 text-[11px]",
        lg: "h-12 px-7",
        full: "h-11 w-full px-5",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // For the gold variant we wrap children in a z-raised span so the metallic
    // overlay pseudo-elements sit behind the label.
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
        {variant === "gold" ? <span className="relative z-10 inline-flex items-center gap-2">{children}</span> : children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
