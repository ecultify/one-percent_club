"use client";

/**
 * CoinTrailToNavbar
 * ─────────────────────────────────────────────────────────────────
 * Bridges the 3D pot animation to the navbar's running pot total.
 * When `triggerKey` changes, this component:
 *   1. Reads the source rect from `sourceRef` (the 3D pot wrapper).
 *   2. Reads the target rect via `targetSelector` (default = the
 *      QuestionScreen's data-tour-id="pot-prize" element).
 *   3. Spawns `coinCount` DOM coins that arc from source → target,
 *      staggered by 50ms each, peaking high above the source.
 *   4. Pulses the target element's brightness on arrival so the
 *      growing pot total pops in sync.
 *
 * Pure DOM/framer-motion. Doesn't share React state with the 3D scene
 * because the coin handoff happens in screen space, not world space.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { playCoinTink } from "@/lib/uiClickSound";

interface CoinTrailToNavbarProps {
  /** Increment to fire a fresh trail. Set to null to clear. */
  triggerKey: number | null;
  /** The source element rect provider (typically the pot canvas wrapper). */
  sourceRef: React.RefObject<HTMLElement | null>;
  /** CSS selector for the navbar pot card. */
  targetSelector?: string;
  /** How many coins to fly. Capped client-side at 20. */
  coinCount?: number;
  /** Called once the last coin has arrived. */
  onComplete?: () => void;
}

interface TrailPath {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  key: number;
}

const COIN_BASE_DURATION_MS = 720;
const COIN_STAGGER_MS = 55;
const TRAIL_ZINDEX = 9999;

export default function CoinTrailToNavbar({
  triggerKey,
  sourceRef,
  targetSelector = '[data-tour-id="pot-prize"]',
  coinCount = 14,
  onComplete,
}: CoinTrailToNavbarProps) {
  const [path, setPath] = useState<TrailPath | null>(null);

  useEffect(() => {
    if (triggerKey == null) return;
    let cancelled = false;
    let rafId = 0;
    const timers: number[] = [];

    const usedCoinCount = Math.min(20, Math.max(4, coinCount));
    const lastCoinArrivalMs =
      COIN_BASE_DURATION_MS + (usedCoinCount - 1) * COIN_STAGGER_MS;

    // Wait one frame so any layout / animation that just settled has been
    // measured by the browser before we read getBoundingClientRect. Without
    // this, measuring on the same tick as a layout change occasionally gave
    // stale rects (source at 0,0) and the coins flew from the top-left.
    rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      const src = sourceRef.current;
      const tgt = document.querySelector<HTMLElement>(targetSelector);
      if (!src || !tgt) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("[CoinTrailToNavbar] missing endpoints", {
            haveSource: !!src,
            haveTarget: !!tgt,
            targetSelector,
          });
        }
        return;
      }

      const sRect = src.getBoundingClientRect();
      const tRect = tgt.getBoundingClientRect();

      // Sanity-check: if either rect has zero dimensions we're measuring
      // before layout — bail out so the coin shower doesn't fire from
      // nowhere to nowhere.
      if (sRect.width === 0 || tRect.width === 0) return;

      setPath({
        // Source = centre of the "+ ₹X this round" tile so coins emerge
        // from the chip itself rather than its corner.
        sx: sRect.left + sRect.width * 0.5,
        sy: sRect.top + sRect.height * 0.5,
        tx: tRect.left + tRect.width * 0.5,
        ty: tRect.top + tRect.height * 0.5,
        key: triggerKey,
      });

      // Pulse the navbar a beat before the last coin lands so the
      // brightness overlaps with the coin shower instead of trailing
      // behind it.
      const pulseAt = Math.max(lastCoinArrivalMs - 220, 200);
      timers.push(
        window.setTimeout(() => {
          tgt.classList.add("pot-prize-pulse");
          timers.push(
            window.setTimeout(() => tgt.classList.remove("pot-prize-pulse"), 720),
          );
        }, pulseAt),
      );

      // Audio: schedule a "tink" for each coin's arrival. Slight detune
      // per coin so the shower has musical variation instead of monotone.
      for (let i = 0; i < usedCoinCount; i++) {
        const arriveAt = COIN_BASE_DURATION_MS + i * COIN_STAGGER_MS;
        const detune = (i * 53) % 200 - 100;
        timers.push(
          window.setTimeout(() => {
            playCoinTink(detune);
          }, arriveAt),
        );
      }

      // Wipe the path once the last coin has arrived + a small grace period.
      timers.push(
        window.setTimeout(() => {
          onComplete?.();
          setPath(null);
        }, lastCoinArrivalMs + 250),
      );
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      timers.forEach((id) => window.clearTimeout(id));
      // Best-effort: clear the pulse class if it was applied. We re-resolve
      // the target by selector so we don't depend on a closed-over `tgt`
      // that might have been re-mounted in the meantime.
      const tgt2 = document.querySelector<HTMLElement>(targetSelector);
      tgt2?.classList.remove("pot-prize-pulse");
    };
  }, [triggerKey, sourceRef, targetSelector, coinCount, onComplete]);

  if (!path) return null;

  const usedCoinCount = Math.min(20, Math.max(4, coinCount));
  const dy = path.ty - path.sy;
  // Higher arc when the navbar is far away (typical, since the pot sits
  // mid-screen and the navbar is at the top edge).
  const arcPeak = -Math.abs(dy) * 0.55 - 90;

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: TRAIL_ZINDEX }}
    >
      {Array.from({ length: usedCoinCount }).map((_, i) => {
        const offsetX = (Math.random() - 0.5) * 26;
        const offsetY = (Math.random() - 0.5) * 16;
        const peakOffset = arcPeak + (Math.random() - 0.5) * 50;
        const lateralPeak = (Math.random() - 0.5) * 70;
        const dur = (COIN_BASE_DURATION_MS + (Math.random() - 0.5) * 120) / 1000;

        return (
          <motion.div
            key={`${path.key}-${i}`}
            initial={{
              left: path.sx + offsetX,
              top: path.sy + offsetY,
              scale: 0.55,
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              left: [
                path.sx + offsetX,
                path.sx + (path.tx - path.sx) * 0.45 + lateralPeak,
                path.tx,
              ],
              top: [
                path.sy + offsetY,
                path.sy + peakOffset,
                path.ty,
              ],
              scale: [0.55, 1.15, 0.5],
              opacity: [0, 1, 0],
              rotate: [0, 240, 520],
            }}
            transition={{
              duration: dur,
              delay: (i * COIN_STAGGER_MS) / 1000,
              ease: [0.42, 0, 0.78, 1], // ease-in for that "shooting" feel
              times: [0, 0.5, 1],
            }}
            style={{
              position: "fixed",
              width: 22,
              height: 22,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 32% 30%, #fff0b3 0%, #ffd460 38%, #c48a1c 72%, #6e4810 100%)",
              boxShadow:
                "0 0 14px rgba(255, 200, 80, 0.75), inset 0 -3px 5px rgba(0,0,0,0.4), inset 0 2px 3px rgba(255,255,255,0.4)",
              willChange: "left, top, transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
}
