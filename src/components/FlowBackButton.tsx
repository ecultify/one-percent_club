"use client";

import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

interface FlowBackButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Centered in the top bar — left-arrow only, circular — avoids the top-left 3D logo.
 * (Mute / skip stay bottom-right; logo stays top-left or corner after fly-to-corner.)
 */
export default function FlowBackButton({ onClick, className = "" }: FlowBackButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={
        "fixed top-3 left-1/2 z-[100] -translate-x-1/2 flex h-9 w-9 items-center justify-center " +
        "rounded-full border border-brass/35 bg-[#080508]/90 shadow-[0_4px_22px_rgba(0,0,0,0.55)] " +
        "backdrop-blur-md pointer-events-auto transition-colors hover:border-brass/55 " +
        "hover:bg-[#0c080c]/95 text-brass-bright/95 hover:text-brass-bright " +
        className
      }
      aria-label="Go back"
    >
      <ChevronLeft className="size-5 -ml-0.5 shrink-0" strokeWidth={2.2} aria-hidden />
    </motion.button>
  );
}
