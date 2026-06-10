import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** shadcn Badge, themed for the black host UI (status pills). */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]",
  {
    variants: {
      variant: {
        default: "border-white/15 bg-white/10 text-white/80",
        running: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
        ended: "border-white/10 bg-white/10 text-white/55",
        danger: "border-red-500/30 bg-red-950/40 text-red-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
