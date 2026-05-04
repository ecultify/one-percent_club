"use client";

/* ─────────────────────────────────────────────────────────────────
 *  useVideoManager
 *  ────────────────────────────────────────────────────────────────
 *  Simple state hook that pairs with VideoPlayer to coordinate
 *  source switching + non-decoding preload of upcoming clips.
 *
 *  Usage:
 *    const { currentSrc, play, preload, stop } = useVideoManager();
 *    // ...
 *    <VideoPlayer src={currentSrc} ... />
 *    // Switch:    play("/q2intro.mp4");
 *    // Preload:   preload("/q2_correct.mp4");
 *    // Stop:      stop();
 *
 *  preload() injects <link rel="preload" as="video"> into <head>
 *  WITHOUT mounting a hidden <video> element. This means the file
 *  is fetched and warmed in the browser HTTP cache, but no decoder
 *  is allocated for it — so it can't compete with the currently-
 *  playing foreground video.
 *
 *  When the parent later switches to that src via play(), the
 *  VideoPlayer element will fetch from cache (200 from disk-cache)
 *  and decode without a network roundtrip.
 *  ───────────────────────────────────────────────────────────────── */

import { useCallback, useRef, useState } from "react";

export function useVideoManager(initialSrc?: string) {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(initialSrc);
  /** Keep a memory of what we've already injected so we never stack
   *  duplicate <link> tags during re-renders. */
  const preloadedRef = useRef<Set<string>>(new Set());

  const play = useCallback((src: string) => {
    setCurrentSrc(src);
  }, []);

  const stop = useCallback(() => {
    setCurrentSrc(undefined);
  }, []);

  const preload = useCallback((src: string) => {
    if (typeof document === "undefined") return;
    if (preloadedRef.current.has(src)) return;
    preloadedRef.current.add(src);

    // Idempotent guard — also dedupe by element id in case two
    // separate hooks try to preload the same source.
    const id = `vmgr-preload-${src}`;
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "preload";
    link.as = "video";
    link.href = src;
    // No crossOrigin — same-origin assets don't need it, and
    // cross-origin R2 dev URL doesn't return CORS headers anyway.
    document.head.appendChild(link);
  }, []);

  return { currentSrc, play, preload, stop };
}
