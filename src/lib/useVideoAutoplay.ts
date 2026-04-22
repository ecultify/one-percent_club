"use client";

import { useEffect, type RefObject } from "react";

/**
 * Robust video autoplay/keep-alive hook.
 *
 * Browsers — especially after a page reload, after the tab loses focus, or when
 * the video source comes from a CDN with a slow first-byte — silently fail to
 * start `<video autoPlay>` even though `playsInline` and `muted` are correct.
 * The vanilla `onCanPlay` handler isn't enough because the play() call may
 * race with React mounting / framer-motion's enter animation.
 *
 * This hook attaches a belt-and-braces set of listeners that all call
 * `video.play()`:
 *   - loadeddata / canplay / canplaythrough — try as soon as data is ready
 *   - stalled / waiting / suspend            — recover from buffering hiccups
 *   - visibilitychange / focus / pageshow    — recover after tab/window switch
 * Plus a short polling watchdog that re-issues play() if the element is paused
 * but ready (catches the "user reloaded with bfcache" case where none of the
 * media events fire because the element thinks it's already loaded).
 *
 * Pass `active=false` to disable (e.g., the overlay isn't currently mounted).
 */
export function useVideoAutoplay(
  ref: RefObject<HTMLVideoElement | null>,
  active: boolean = true,
): void {
  useEffect(() => {
    if (!active) return;
    const v = ref.current;
    if (!v) return;

    const tryPlay = () => {
      if (v.paused) {
        void v.play().catch(() => {});
      }
    };

    // Immediate kick — handles the bfcache / cached-source case.
    tryPlay();

    const events = [
      "loadeddata",
      "canplay",
      "canplaythrough",
      "stalled",
      "waiting",
      "suspend",
      "loadedmetadata",
    ] as const;
    events.forEach((evt) => v.addEventListener(evt, tryPlay));

    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        tryPlay();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", tryPlay);
      window.addEventListener("pageshow", tryPlay);
    }

    // Watchdog — first 3 seconds, poll every 250ms. Cheap insurance for the
    // case where readyState never changes (browser thinks the element is
    // ready but autoPlay didn't fire).
    let ticks = 0;
    const interval = window.setInterval(() => {
      ticks += 1;
      if (v.readyState >= 2) tryPlay();
      if (ticks >= 12) window.clearInterval(interval);
    }, 250);

    return () => {
      events.forEach((evt) => v.removeEventListener(evt, tryPlay));
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", tryPlay);
        window.removeEventListener("pageshow", tryPlay);
      }
      window.clearInterval(interval);
    };
  }, [ref, active]);
}
