"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useNarration } from "./NarrationProvider";

/** Same 8-stop polished brass used elsewhere (.metallic-chip, hero CTAs) — re-used for the
 *  bottom progress bar so the fill matches the rest of the site's gold language. */
const BRASS_GRADIENT = `linear-gradient(90deg,
  #6d4e13 0%,
  #9c7819 8%,
  #c99d2e 22%,
  #e8c458 36%,
  #f7e092 46%,
  #fff4bf 52%,
  #f4dc7c 60%,
  #d9b446 72%,
  #9c7819 88%,
  #5c3e0d 100%
)`;

export default function Overlay() {
  return (
    <>
      {/* 500vh scroll-driven hero column. The sticky child stays glued to the
          viewport while the user scrolls through the scrolly canvas underneath. */}
      <div className="pointer-events-none absolute top-0 left-0 z-10 h-[500vh] w-full">
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <ScrollDownGlassButton />
        </div>
      </div>

      {/* Page-level scroll progress indicator — fixed to the very bottom edge,
          full bleed, no margin. Lives outside the absolutely-positioned column
          so it stays anchored to the viewport regardless of overlay layering. */}
      <ScrollProgressBar />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Liquid-glass "Scroll down" pill, intentionally NON-clickable (per spec).
 *
 * Behaviour change (per latest spec):
 *  - Stays visible through the WHOLE scrolly section (previously faded out
 *    after ~12% of scroll). Only fades right at the end of the scroll, when
 *    the user is about to land on the final frame and the GameFlow "Enter"
 *    button takes over.
 *  - Doubles as a progress indicator: a brass-gradient fill grows
 *    left-to-right inside the pill as scrollYProgress climbs from 0 → 1,
 *    so by the last frame the pill is solid gold.
 *
 * Anchored low in the viewport. The breath / chevron animations are kept
 * because they sell "alive" while the user reads.
 */
function ScrollDownGlassButton() {
  const { scrollYProgress } = useScroll();
  // Hold at full opacity through the whole scroll. Only fade in the very
  // last 5% so the handoff to the GameFlow Enter button feels clean.
  const opacity = useTransform(scrollYProgress, [0, 0.95, 1], [1, 1, 0]);
  // Tiny lift only at the very end — same end-of-scroll exit motion.
  const y = useTransform(scrollYProgress, [0, 0.95, 1], [0, 0, -16]);
  // Position + opacity for the leading-edge specular highlight on the brass
  // fill. Hoisted out of the JSX to keep useTransform calls at the top of
  // the component (rules-of-hooks friendly).
  const highlightLeft = useTransform(scrollYProgress, (v) => `${v * 100 - 7}%`);
  const highlightOpacity = useTransform(
    scrollYProgress,
    [0, 0.04, 0.96, 1],
    [0, 1, 1, 0],
  );

  return (
    // Static wrapper handles horizontal centering. We can't combine
    // Tailwind's `-translate-x-1/2` with framer-motion's `y` motion value on
    // the same element — the runtime transform set by framer overwrites the
    // class-based transform, knocking the button to the right of center.
    <div
      className="pointer-events-none fixed bottom-[14vh] left-0 right-0 z-[12] flex justify-center"
      aria-hidden
    >
      <motion.div style={{ opacity, y }}>
        <motion.div
          // Idle breath — slow scale + glow pulse so the pill feels alive
          // without distracting from the scrolly canvas behind it.
          animate={{ scale: [1, 1.025, 1] }}
          transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
          // `relative` + `overflow-hidden` so the brass fill child is
          // clipped to the rounded-full silhouette of the pill.
          className="relative flex items-center gap-3 overflow-hidden rounded-full px-7 py-4 font-mono text-[10px] font-semibold uppercase tracking-[0.36em] text-white/95 sm:px-8 sm:py-[18px] sm:text-[11px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.10) 100%)",
            backdropFilter: "blur(22px) saturate(1.55)",
            WebkitBackdropFilter: "blur(22px) saturate(1.55)",
            border: "1px solid rgba(255,255,255,0.28)",
            boxShadow: [
              "inset 0 1px 0 rgba(255,255,255,0.42)",
              "inset 0 -1px 0 rgba(0,0,0,0.28)",
              "0 14px 32px -10px rgba(0,0,0,0.55)",
              "0 0 0 1px rgba(255,255,255,0.05)",
            ].join(", "),
          }}
        >
          {/* Brass-metallic fill that tracks scroll progress. Anchored to the
              left edge via origin-left + scaleX, so the gold paints across
              the pill from 0% (empty / pure glass) to 100% (solid gold) as
              the user scrolls through the entire 500vh column. Sits behind
              the text + chevron at z-0 so they remain on top. */}
          <motion.div
            aria-hidden
            className="absolute inset-0 origin-left"
            style={{
              scaleX: scrollYProgress,
              background: BRASS_GRADIENT,
              boxShadow:
                "inset 0 1px 0 rgba(255,250,220,0.85), inset 0 -1px 0 rgba(40,22,0,0.45)",
            }}
          />
          {/* Soft inner highlight on the leading edge of the fill so the
              transition between gold and glass reads as a wet specular
              edge rather than a hard cut. */}
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-[14%]"
            style={{
              left: highlightLeft,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,240,0.7) 50%, transparent 100%)",
              mixBlendMode: "screen",
              opacity: highlightOpacity,
            }}
          />
          <span
            className="relative z-10"
            style={{
              // Strong shadow keeps the white text readable against both the
              // dark glass (early scroll) and the bright gold (late scroll).
              textShadow:
                "0 0 2px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.55), 0 0 14px rgba(0,0,0,0.4)",
            }}
          >
            Scroll down
          </span>
          <motion.span
            aria-hidden
            className="relative z-10 flex items-center justify-center"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              filter:
                "drop-shadow(0 0 2px rgba(0,0,0,0.9)) drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 13l7 7 7-7" />
            </svg>
          </motion.span>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Edge-to-edge progress bar pinned to the bottom of the viewport. Width tracks
 * page scrollYProgress, fill is the same brass gradient used across the site's
 * primary controls so the indicator reads as part of the same visual system.
 *
 * pointer-events-none so it never intercepts clicks meant for content below.
 */
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  // Hide the bar the moment the user clicks "Continue with sound" on the
  // AudioPrimingGate. `audioUnlocked` flips inside NarrationProvider.unlock(),
  // so any future entry path that calls unlock() will trigger the same hide.
  const { audioUnlocked } = useNarration();

  return (
    <AnimatePresence>
      {!audioUnlocked && (
        <motion.div
          key="scroll-progress-bar"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[150] h-[5px]"
          aria-hidden
          style={{
            background: "rgba(0,0,0,0.55)",
            boxShadow: "0 -1px 0 rgba(0,0,0,0.6)",
          }}
        >
          <motion.div
            className="relative h-full origin-left overflow-hidden"
            style={{
              scaleX: scrollYProgress,
              background: BRASS_GRADIENT,
              boxShadow:
                "0 0 12px rgba(228, 174, 68, 0.55), 0 0 22px rgba(228, 174, 68, 0.35), inset 0 1px 0 rgba(255,250,220,0.85), inset 0 -1px 0 rgba(40,22,0,0.45)",
            }}
          >
            {/* Moving specular highlight — a thin bright band that slides
                across the filled portion of the bar on a slow loop, so the
                gold reads as polished metal rather than painted-on. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-[40%]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,240,0.55) 45%, rgba(255,255,255,0.85) 50%, rgba(255,255,240,0.55) 55%, transparent 100%)",
                mixBlendMode: "screen",
              }}
              animate={{ x: ["-50%", "260%"] }}
              transition={{
                duration: 3.6,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 1.4,
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
