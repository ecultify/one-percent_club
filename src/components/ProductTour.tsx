"use client";

/**
 * SaaS-style product tour with an SVG-masked spotlight.
 *
 * How the spotlight works:
 *   We render a full-viewport <svg> with a <mask> that is fully white
 *   (opaque dim) except for a rounded rectangle carved out in black
 *   (transparent) where the target element is. We then fill a rect that
 *   covers the whole viewport with rgba(0,0,0,0.78) and apply the mask —
 *   which gives us a guaranteed, pixel-perfect dim overlay with a clean
 *   cutout around the element. This technique is more reliable than the
 *   box-shadow hack under complex z-index / stacking contexts.
 *
 * Other features:
 *   - Re-measures target via ResizeObserver + window events + retry loop
 *   - Narration per step awaited via Promise; auto-advances when voice ends
 *   - User can click Next/Back/Skip at any time
 *   - Tooltip placement auto-adjusts to viewport
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNarration } from "./NarrationProvider";

export interface TourStep {
  targetId: string;
  placement?: "top" | "bottom" | "left" | "right";
  kicker: string;
  title: string;
  description: string;
  voiceText: string;
  voiceKey: string;
  padding?: number;
}

interface ProductTourProps {
  steps: TourStep[];
  onFinish: () => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const DEFAULT_PADDING = 12;
const TOOLTIP_WIDTH = 340;
const TOOLTIP_HEIGHT = 220;
const GAP = 18;

function getTargetRect(id: string): Rect | null {
  if (typeof window === "undefined") return null;
  const el = document.querySelector(`[data-tour-id="${id}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Reject zero-size / offscreen rects (element not laid out yet)
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function computeTooltipPosition(
  spotlight: Rect,
  placement: "top" | "bottom" | "left" | "right",
): { top: number; left: number; placement: "top" | "bottom" | "left" | "right" } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = spotlight.left + spotlight.width / 2;
  const cy = spotlight.top + spotlight.height / 2;

  const candidates: Record<
    "top" | "bottom" | "left" | "right",
    { top: number; left: number }
  > = {
    top: { top: spotlight.top - TOOLTIP_HEIGHT - GAP, left: cx - TOOLTIP_WIDTH / 2 },
    bottom: { top: spotlight.top + spotlight.height + GAP, left: cx - TOOLTIP_WIDTH / 2 },
    left: { top: cy - TOOLTIP_HEIGHT / 2, left: spotlight.left - TOOLTIP_WIDTH - GAP },
    right: { top: cy - TOOLTIP_HEIGHT / 2, left: spotlight.left + spotlight.width + GAP },
  };

  const fits = (p: "top" | "bottom" | "left" | "right"): boolean => {
    const c = candidates[p];
    if (p === "top" && c.top < 12) return false;
    if (p === "bottom" && c.top + TOOLTIP_HEIGHT > vh - 12) return false;
    if (p === "left" && c.left < 12) return false;
    if (p === "right" && c.left + TOOLTIP_WIDTH > vw - 12) return false;
    return true;
  };

  const order: Array<"top" | "bottom" | "left" | "right"> = [
    placement,
    placement === "top" ? "bottom" : placement === "bottom" ? "top" : placement,
    "bottom",
    "top",
    "right",
    "left",
  ];

  for (const p of order) {
    if (fits(p)) {
      const c = candidates[p];
      return {
        top: Math.max(12, Math.min(c.top, vh - TOOLTIP_HEIGHT - 12)),
        left: Math.max(12, Math.min(c.left, vw - TOOLTIP_WIDTH - 12)),
        placement: p,
      };
    }
  }

  // Ultimate fallback: pinned center-bottom of screen
  return {
    top: vh - TOOLTIP_HEIGHT - 24,
    left: Math.max(12, Math.min(cx - TOOLTIP_WIDTH / 2, vw - TOOLTIP_WIDTH - 12)),
    placement: "bottom",
  };
}

export default function ProductTour({ steps, onFinish, onSkip }: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom" | "left" | "right";
  } | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1440, h: 900 },
  );
  const [voiceActive, setVoiceActive] = useState(false);
  const { narrate, stop, muted } = useNarration();

  const currentStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const padding = currentStep?.padding ?? DEFAULT_PADDING;

  // Track viewport size so SVG rect fills current window
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Measurement: retry loop + observers — critical for reliable highlighting
  useLayoutEffect(() => {
    if (!currentStep) return;

    let stopped = false;
    let observer: ResizeObserver | null = null;
    const retryDelays = [0, 30, 100, 250, 500, 1000]; // retry schedule in ms
    const timers: ReturnType<typeof setTimeout>[] = [];

    const update = () => {
      if (stopped) return;
      const r = getTargetRect(currentStep.targetId);
      if (r) {
        const spot = {
          top: r.top - padding,
          left: r.left - padding,
          width: r.width + padding * 2,
          height: r.height + padding * 2,
        };
        setRect(r);
        setTooltipPos(computeTooltipPosition(spot, currentStep.placement ?? "bottom"));

        // Observe the target for any future size changes
        if (!observer) {
          const el = document.querySelector(
            `[data-tour-id="${currentStep.targetId}"]`,
          ) as HTMLElement | null;
          if (el && typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(() => update());
            observer.observe(el);
          }
        }
      }
    };

    // Immediate + scheduled retries to catch animating-in elements
    update();
    retryDelays.forEach((d) => {
      const t = setTimeout(update, d);
      timers.push(t);
    });

    const onScroll = () => update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
      if (observer) observer.disconnect();
    };
  }, [currentStep, padding]);

  // Fire narration per step + auto-advance when voice finishes
  useEffect(() => {
    if (!currentStep) return;

    let cancelled = false;
    setVoiceActive(true);

    narrate(currentStep.voiceKey, currentStep.voiceText).then(() => {
      setVoiceActive(false);
      if (cancelled) return;
      // Only auto-advance if voice actually played (not muted)
      if (!muted) {
        // Small buffer so user has a moment to read before moving on
        const t = setTimeout(() => {
          if (cancelled) return;
          setStepIndex((i) => (i < steps.length - 1 ? i + 1 : i));
          if (stepIndex === steps.length - 1) onFinish();
        }, 700);
        return () => clearTimeout(t);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, currentStep]);

  const handleNext = useCallback(() => {
    stop();
    if (isLast) {
      onFinish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLast, onFinish, stop]);

  const handlePrev = useCallback(() => {
    stop();
    setStepIndex((i) => Math.max(0, i - 1));
  }, [stop]);

  const handleSkip = useCallback(() => {
    stop();
    onSkip();
  }, [onSkip, stop]);

  if (!currentStep) return null;

  // Spotlight rect including padding
  const spot = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  return (
    <AnimatePresence>
      <motion.div
        key="product-tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[70] pointer-events-none"
      >
        {/* ━━ SVG masked overlay: rock-solid dim + cutout spotlight ━━ */}
        <svg
          className="absolute inset-0"
          width={viewport.w}
          height={viewport.h}
          viewBox={`0 0 ${viewport.w} ${viewport.h}`}
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <mask id="spotlight-mask" maskUnits="userSpaceOnUse">
              {/* White fills everything — areas painted become dim */}
              <rect x={0} y={0} width={viewport.w} height={viewport.h} fill="white" />
              {/* Black carves out the spotlight — areas become transparent */}
              {spot && (
                <rect
                  x={spot.left}
                  y={spot.top}
                  width={spot.width}
                  height={spot.height}
                  rx={14}
                  ry={14}
                  fill="black"
                  style={{
                    transition: "x 0.4s cubic-bezier(0.23,1,0.32,1), y 0.4s cubic-bezier(0.23,1,0.32,1), width 0.4s, height 0.4s",
                  }}
                />
              )}
            </mask>
          </defs>

          {/* Dark dim, masked so the cutout is transparent */}
          <rect
            x={0}
            y={0}
            width={viewport.w}
            height={viewport.h}
            fill="rgba(0,0,0,0.82)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Glowing brass border around the spotlight */}
        {spot && (
          <motion.div
            key={`spot-border-${stepIndex}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="absolute rounded-[14px] border-2 border-brass-bright pointer-events-none"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              boxShadow:
                "0 0 40px rgba(228,207,106,0.5), 0 0 80px rgba(196,160,53,0.25), inset 0 0 20px rgba(228,207,106,0.15)",
              transition:
                "top 0.4s cubic-bezier(0.23,1,0.32,1), left 0.4s cubic-bezier(0.23,1,0.32,1), width 0.4s, height 0.4s",
            }}
          >
            <motion.div
              className="absolute inset-0 rounded-[14px] border-2 border-brass-bright/60"
              animate={{ opacity: [0.3, 0.9, 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}

        {/* Tooltip card */}
        {tooltipPos && spot && (
          <motion.div
            key={`tip-${stepIndex}`}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
            className="absolute pointer-events-auto"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              width: TOOLTIP_WIDTH,
              transition:
                "top 0.4s cubic-bezier(0.23,1,0.32,1), left 0.4s cubic-bezier(0.23,1,0.32,1)",
            }}
          >
            <div className="relative rounded-xl border-2 border-brass/30 bg-gradient-to-b from-surface-light/98 to-surface/98 p-5 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85),0_0_40px_-10px_rgba(196,160,53,0.25)] backdrop-blur-md">
              <TooltipArrow placement={tooltipPos.placement} />

              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-brass-dim">
                  {currentStep.kicker}
                </p>
                <p className="font-mono text-[10px] text-muted tabular-nums">
                  {stepIndex + 1} / {steps.length}
                </p>
              </div>

              <h4 className="font-display text-[1.15rem] font-semibold text-foreground leading-tight mb-2">
                {currentStep.title}
              </h4>

              <p className="text-[13px] text-foreground/70 leading-relaxed mb-4">
                {currentStep.description}
              </p>

              {/* Voice playing indicator */}
              {voiceActive && !muted && (
                <div className="flex items-center gap-1.5 mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-brass-dim">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brass-bright opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brass-bright" />
                  </span>
                  Voice explaining
                </div>
              )}

              <div className="mb-4 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-brass to-brass-bright"
                  initial={{ width: 0 }}
                  animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handleSkip}
                  className="text-[10px] font-mono uppercase tracking-[0.22em] text-brass-dim hover:text-brass-bright transition-colors"
                >
                  Skip tour
                </button>
                <div className="flex items-center gap-2">
                  {stepIndex > 0 && (
                    <button
                      onClick={handlePrev}
                      className="rounded-lg border border-brass/30 bg-black/40 px-3.5 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-brass-dim hover:text-brass-bright hover:border-brass/50 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <motion.button
                    onClick={handleNext}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="game-show-btn relative z-0 rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                  >
                    <span className="relative z-10">{isLast ? "Start game" : "Next →"}</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function TooltipArrow({ placement }: { placement: "top" | "bottom" | "left" | "right" }) {
  const base =
    "absolute w-3 h-3 bg-gradient-to-b from-surface-light/98 to-surface/98 border-brass/30 rotate-45";
  switch (placement) {
    case "top":
      return (
        <div className={`${base} -bottom-[7px] left-1/2 -translate-x-1/2 border-r-2 border-b-2`} />
      );
    case "bottom":
      return (
        <div className={`${base} -top-[7px] left-1/2 -translate-x-1/2 border-l-2 border-t-2`} />
      );
    case "left":
      return (
        <div className={`${base} -right-[7px] top-1/2 -translate-y-1/2 border-t-2 border-r-2`} />
      );
    case "right":
      return (
        <div className={`${base} -left-[7px] top-1/2 -translate-y-1/2 border-b-2 border-l-2`} />
      );
  }
}
