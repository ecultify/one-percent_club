"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type RefObject } from "react";

/** How long after the Enter button becomes visible (or after the
 *  previous hint cycle finishes) before the cursor flies in again.
 *  Per spec: "every 5 secs". */
const HINT_INTERVAL_MS = 5000;
/** Total duration of one hint animation (fly-in + click pulse + fade-out). */
const ANIM_DURATION_MS = 1800;
/** Fly-in portion as a fraction of ANIM_DURATION_MS. */
const FLY_FRAC = 0.55;
/** Click pulse portion (after fly-in). */
const CLICK_FRAC = 0.15;

type Props = {
  /** True while the Enter button is on screen and the user has not yet
   *  clicked it. Drives the on/off state of the hint cycle. */
  visible: boolean;
  /** Ref to the Enter button — used to compute the cursor's landing
   *  point on the button's lower-left arc. Must be the actual rendered
   *  element (we read getBoundingClientRect). */
  buttonRef: RefObject<HTMLButtonElement | null>;
};

/**
 * EnterButtonHint
 * ─────────────────────────────────────────────────────────────────
 * After 5 seconds of the Enter CTA being visible without a click, a
 * golden metallic mouse-cursor sweeps in from the bottom-left of the
 * screen, points at the lower-left arc of the Enter button, performs
 * a brief "click" pulse, then fades out. Repeats every 5 seconds
 * until the user actually clicks Enter (at which point `visible`
 * flips to false and the cycle stops).
 *
 * The component renders nothing until the first cycle fires, and is
 * `pointer-events: none` throughout so it never intercepts the user's
 * own click on the underlying button.
 */
export default function EnterButtonHint({ visible, buttonRef }: Props) {
  const [showHint, setShowHint] = useState(false);
  /** Bumped every cycle so AnimatePresence treats each appearance as a
   *  fresh element (and replays the animation from scratch). */
  const [animKey, setAnimKey] = useState(0);
  /** Where the cursor tip should land on screen (px, viewport-relative).
   *  Recomputed each cycle from the button's current bounding rect so the
   *  hint adapts to window resize / orientation changes between cycles. */
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  /** Cached viewport height at the moment the cycle starts — used so the
   *  cursor can begin off-screen below the bottom edge. Avoids reading
   *  window.innerHeight inside the JSX (SSR-safe). */
  const startYRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) {
      setShowHint(false);
      return;
    }

    let activeTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const cycle = () => {
      if (cancelled) return;
      const btn = buttonRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        // Land the cursor TIP directly on the "ENTER" text in the center
        // of the button. The CursorSVG path starts at (3, 2) inside its
        // 24x24 viewBox; the SVG itself is rendered at 44x44 px, so the
        // visible tip sits at roughly (5.5, 3.7) px from the SVG's
        // top-left corner. To put that tip at the button's center we
        // position the wrapper top-left at (centerX - 5.5, centerY - 3.7).
        // Result: cursor tip lands ON the text, with the cursor body
        // angling down-right out of the way so the word stays readable.
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const TIP_OFFSET_X = 5.5;
        const TIP_OFFSET_Y = 3.7;
        setTarget({
          x: cx - TIP_OFFSET_X,
          y: cy - TIP_OFFSET_Y,
        });
      }
      startYRef.current = typeof window !== "undefined" ? window.innerHeight + 80 : 1000;
      setAnimKey((k) => k + 1);
      setShowHint(true);

      // After the animation finishes, hide and schedule the next cycle.
      activeTimeout = setTimeout(() => {
        if (cancelled) return;
        setShowHint(false);
        activeTimeout = setTimeout(cycle, HINT_INTERVAL_MS);
      }, ANIM_DURATION_MS);
    };

    // Initial wait before the FIRST cycle.
    activeTimeout = setTimeout(cycle, HINT_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (activeTimeout) clearTimeout(activeTimeout);
    };
  }, [visible, buttonRef]);

  return (
    <AnimatePresence>
      {showHint && target && (
        <motion.div
          key={animKey}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-40"
          initial={{
            x: -80,
            y: startYRef.current,
            opacity: 0,
            scale: 0.55,
            rotate: -8,
          }}
          animate={{
            x: [-80, target.x, target.x, target.x, target.x],
            y: [startYRef.current, target.y, target.y, target.y, target.y],
            opacity: [0, 1, 1, 1, 0],
            scale: [0.55, 1, 0.78, 1, 1],
            rotate: [-8, 0, 0, 0, 0],
          }}
          transition={{
            duration: ANIM_DURATION_MS / 1000,
            times: [
              0,
              FLY_FRAC,
              FLY_FRAC + CLICK_FRAC * 0.5,
              FLY_FRAC + CLICK_FRAC,
              1,
            ],
            ease: "easeOut",
          }}
        >
          <CursorSVG />
          {/* Click ripple — a ring that expands outward at the moment the
              cursor "presses". Triggers via a delayed framer animation so
              it lines up with the scale-down dip above. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 block rounded-full"
            style={{
              width: 14,
              height: 14,
              transform: "translate(-50%, -50%)",
              border: "2px solid rgba(251,191,36,0.85)",
              boxShadow: "0 0 12px rgba(251,191,36,0.6)",
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.4, 2.4, 3.0] }}
            transition={{
              duration: 0.55,
              delay: (ANIM_DURATION_MS / 1000) * FLY_FRAC,
              ease: "easeOut",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Golden metallic mouse cursor — classic arrow shape, vertical
 * gradient from pale champagne highlight at the top through warm
 * brass mid-tone down to deep amber at the tip. A second softer
 * gradient overlays a diagonal "shine" stripe to suggest a polished
 * metal surface under raking light.
 */
function CursorSVG() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.55)) drop-shadow(0 0 6px rgba(251,191,36,0.45))",
      }}
    >
      <defs>
        <linearGradient id="ebh-gold-body" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#fff7d6" />
          <stop offset="22%" stopColor="#fde68a" />
          <stop offset="48%" stopColor="#fbbf24" />
          <stop offset="74%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="ebh-gold-shine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="48%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="62%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Cursor arrow path — origin at SVG (0,0) so the hot-spot / tip
          sits at the top-left of the bounding box. */}
      <path
        d="M3 2 L3 21 L8.2 16 L11.8 22 L14.7 20.7 L11.1 14.8 L18.5 13.4 Z"
        fill="url(#ebh-gold-body)"
        stroke="#5c2e09"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Shine overlay clipped to the same shape */}
      <path
        d="M3 2 L3 21 L8.2 16 L11.8 22 L14.7 20.7 L11.1 14.8 L18.5 13.4 Z"
        fill="url(#ebh-gold-shine)"
      />
    </svg>
  );
}
