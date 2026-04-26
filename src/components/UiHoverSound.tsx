"use client";

/**
 * UiHoverSound
 * ─────────────────────────────────────────────────────────────────
 * Companion to UiClickSound. Plays a subtle hover "tick" when the
 * user enters a clickable surface (button, link, .game-show-btn).
 * Throttled per-element so a fast cursor doesn't fire dozens of
 * sounds, and rate-limited globally to avoid stacking.
 *
 * Opt-out: any element with [data-no-ui-hover] attribute is ignored.
 */

import { useEffect, useRef } from "react";
import { useNarration } from "./NarrationProvider";
import { playUiHover } from "@/lib/uiClickSound";

const HOVER_RATE_LIMIT_MS = 60;

export default function UiHoverSound() {
  const { muted } = useNarration();
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const lastFiredAtRef = useRef(0);
  const lastTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      if (mutedRef.current) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // Avoid retriggering for child element transitions inside the same hit.
      const hit = t.closest(
        "button, [role='button'], .game-show-btn, a[href]:not([href='#'])",
      );
      if (!hit) return;
      if (hit.hasAttribute("disabled")) return;
      if (hit.closest("[data-no-ui-hover]")) return;
      if (lastTargetRef.current === hit) return;
      lastTargetRef.current = hit;
      const now = performance.now();
      if (now - lastFiredAtRef.current < HOVER_RATE_LIMIT_MS) return;
      lastFiredAtRef.current = now;
      playUiHover();
    };
    const onOut = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const related = e.relatedTarget as HTMLElement | null;
      if (!t) return;
      const hit = t.closest(
        "button, [role='button'], .game-show-btn, a[href]:not([href='#'])",
      );
      if (!hit) return;
      // If the cursor is moving to ANOTHER element STILL INSIDE this same
      // button, don't clear lastTarget — that would let mouseover refire
      // on the new child and replay the hover sound. Only clear when the
      // pointer truly leaves the button hitbox.
      if (related && hit.contains(related)) return;
      if (lastTargetRef.current === hit) {
        lastTargetRef.current = null;
      }
    };
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    return () => {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
    };
  }, []);

  return null;
}
