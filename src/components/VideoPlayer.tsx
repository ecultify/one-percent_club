"use client";

/* ─────────────────────────────────────────────────────────────────
 *  VideoPlayer
 *  ────────────────────────────────────────────────────────────────
 *  A single <video> element that swaps its `src` in place WITHOUT
 *  ever unmounting the element. Used to consolidate multiple
 *  foreground videos (intro, reaction, final) into one shared
 *  <video> tag, eliminating decoder remount on every transition.
 *
 *  Key design points:
 *    1. The element is rendered ONCE and persists for the parent's
 *       lifetime. Source switches are driven by useEffect on `src`.
 *    2. On src change: pause previous playback (avoids concurrent
 *       decode), set new src, call load(), call play(). The browser
 *       reuses the existing decoder for the same codec.
 *    3. play() is guarded with .catch(() => {}) because autoplay
 *       can be rejected (browser policy or transient state). The
 *       parent's existing useVideoAutoplay-style watchdog still
 *       provides a safety net.
 *    4. Poster painted immediately on mount or src change so there
 *       is never a black-flash gap before the first decoded frame.
 *
 *  IMPORTANT: this component intentionally renders WITHOUT a `key`
 *  prop forwarded to <video>. The parent should ALSO not pass a key
 *  on the parent element that would cause this whole subtree to
 *  remount on src change — that defeats the purpose. Use stable
 *  parent keys or no parent key at all.
 *  ───────────────────────────────────────────────────────────────── */

import { useEffect, useRef, type RefObject, type SyntheticEvent } from "react";

interface VideoPlayerProps {
  /** Current source URL. When this changes, the element swaps src in place. */
  src: string | null | undefined;
  /** Optional poster image painted before the first frame. */
  poster?: string;
  /** Whether to start playback automatically when src changes. Default true. */
  autoPlay?: boolean;
  /** Whether the video should be muted. Default false. */
  muted?: boolean;
  /** Required on iOS for inline (non-fullscreen) playback. Default true. */
  playsInline?: boolean;
  /** Pass-through className for layout. */
  className?: string;
  /** Fired when the video ends naturally. */
  onEnded?: () => void;
  /** Fired on a fatal media error. */
  onError?: () => void;
  /** Per-frame timing callback. Provides parsed currentTime + duration. */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Optional external ref so the parent can drive .pause(), .play(), etc. */
  externalRef?: RefObject<HTMLVideoElement>;
}

export function VideoPlayer({
  src,
  poster,
  autoPlay = true,
  muted = false,
  playsInline = true,
  className,
  onEnded,
  onError,
  onTimeUpdate,
  externalRef,
}: VideoPlayerProps) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const ref = externalRef ?? internalRef;

  // ── Drive src + load + play imperatively so the <video> element
  //    persists across src changes (no remount, no decoder reset). ──
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!src) {
      // No src: pause any current playback and clear so the element
      // can sit idle without holding decoder state.
      try { v.pause(); } catch { /* ignore */ }
      return;
    }

    // Resolve the source we'd actually be navigating to. We compare
    // against v.currentSrc to avoid a redundant load() that would
    // reset playback when the same src is re-requested (e.g., HMR).
    let absoluteNewSrc: string;
    try {
      absoluteNewSrc = new URL(src, window.location.href).href;
    } catch {
      absoluteNewSrc = src;
    }

    if (v.currentSrc === absoluteNewSrc && v.readyState >= 2) {
      // Already loaded with this src and has data — just (re)play.
      if (autoPlay && v.paused) {
        void v.play().catch(() => { /* ignore autoplay rejection */ });
      }
      return;
    }

    // Pause first to avoid concurrent decode during the swap.
    try { v.pause(); } catch { /* ignore */ }

    // Update src + (optionally) poster. The poster attribute is
    // separately bound below in JSX so React updates it on rerender;
    // we don't need to set it imperatively here.
    v.src = src;

    // load() resets the media element and starts buffering the new
    // resource. Required when changing src on an already-mounted tag.
    try { v.load(); } catch { /* ignore */ }

    if (autoPlay) {
      void v.play().catch(() => { /* ignore autoplay rejection */ });
    }
  }, [src, autoPlay, ref]);

  // Wrap onTimeUpdate so the parent receives parsed values and we
  // skip the call entirely when duration isn't yet known (avoids the
  // duration <= 0 dance every consumer would otherwise replicate).
  const handleTimeUpdate = onTimeUpdate
    ? (e: SyntheticEvent<HTMLVideoElement>) => {
        const el = e.currentTarget;
        if (Number.isFinite(el.duration) && el.duration > 0) {
          onTimeUpdate(el.currentTime, el.duration);
        }
      }
    : undefined;

  return (
    <video
      ref={ref}
      poster={poster}
      muted={muted}
      playsInline={playsInline}
      preload="auto"
      className={className}
      onEnded={onEnded}
      onError={onError}
      onTimeUpdate={handleTimeUpdate}
    />
  );
}
