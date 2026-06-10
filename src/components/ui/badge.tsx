import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** shadcn Badge, themed for the black host UI (status pills). */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
  {
    variants: {
      variant: {
        default: "border-white/15 bg-white/10 text-white/80",
        running: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
        ended: "border-white/10 bg-white/10 text-white/55",
        danger: "border-red-500/30 bg-red-950/40 text-red-300",
        /** Question-set pill (Set A/B/C) on room cards. */
        set: "border-amber-400/30 bg-amber-950/30 text-amber-200",
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
