"use client";

import { motion } from "framer-motion";
import { useNarration } from "./NarrationProvider";

interface MuteButtonProps {
  /** "fixed" = floating button, "inline" = sits in flow */
  variant?: "fixed" | "inline";
  className?: string;
}

export default function MuteButton({ variant = "fixed", className = "" }: MuteButtonProps) {
  const { muted, toggleMute, isSpeaking } = useNarration();

  const base =
    "group flex items-center gap-2 rounded-full border border-white/10 bg-black/55 backdrop-blur-md px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/80 hover:text-foreground hover:border-brass/35 hover:bg-black/70 transition-colors";

  const position =
    variant === "fixed"
      ? "fixed top-4 right-4 md:top-5 md:right-5 z-[80]"
      : "";

  return (
    <motion.button
      onClick={toggleMute}
      aria-label={muted ? "Unmute narration" : "Mute narration"}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      className={`${base} ${position} ${className}`}
    >
      <span className="relative w-4 h-4 flex items-center justify-center">
        {muted ? (
          // Muted icon
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </svg>
        ) : (
          // Unmuted icon with sound waves
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        )}
        {/* Speaking pulse dot */}
        {isSpeaking && !muted && (
          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-brass-bright animate-pulse" />
        )}
      </span>
      <span>{muted ? "Muted" : "Voice on"}</span>
    </motion.button>
  );
}
