import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn Input, themed for the black host UI. */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-white/15 bg-black/60 px-4 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus-visible:border-white/40 focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
