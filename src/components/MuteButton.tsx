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

  // Same metallic brass language as the HUD chips, option badges, and host-speaking pill.
  // Dark engraved icon + label reads as enamel-on-brass. Muted state dims via saturation.
  const base =
    "metallic-chip group flex items-center gap-2 rounded-full px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-transform";

  const position =
    variant === "fixed"
      ? "fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[80]"
      : "";

  const darkInk = "#120a02";
  const darkInkTextShadow =
    "0 1px 0 rgba(255,236,180,0.55), 0 -1px 0 rgba(36,22,0,0.35)";

  return (
    <motion.button
      onClick={toggleMute}
      aria-label={muted ? "Unmute narration" : "Mute narration"}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      className={`${base} ${position} ${className}`}
      style={{
        color: darkInk,
        filter: muted ? "saturate(0.55) brightness(0.82)" : undefined,
        boxShadow: !muted
          ? "0 0 0 1px rgba(92,62,10,0.85), inset 0 1px 0 rgba(255,245,210,0.75), inset 0 -1px 0 rgba(40,24,0,0.55), 0 6px 20px rgba(196,160,53,0.3), 0 0 18px rgba(224,160,43,0.25)"
          : undefined,
      }}
    >
      <span className="relative z-[3] flex w-4 h-4 items-center justify-center">
        {muted ? (
          // Muted icon — dark engraved on brass
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </svg>
        ) : (
          // Unmuted icon with sound waves — dark engraved on brass
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        )}
        {/* Speaking pulse — a dark "indicator light" with warm halo */}
        {isSpeaking && !muted && (
          <>
            <span
              className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#120a02", boxShadow: "0 0 6px rgba(255,245,190,0.9)" }}
            />
          </>
        )}
      </span>
      <span
        className="relative z-[3] font-bold"
        style={{ color: darkInk, textShadow: darkInkTextShadow }}
      >
        {muted ? "Muted" : "Voice on"}
      </span>
    </motion.button>
  );
}
