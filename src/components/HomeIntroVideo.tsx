"use client";

import { useEffect, useRef } from "react";
import { useNarration } from "./NarrationProvider";

const HOME_VIDEO_SRC = "/questionscreenimages/Website1Fa.mp4";
const DHAK_SRC = "/sound/dhak.wav";

/** Dhak hits at these video timestamps (seconds). Mirrors the legacy
 *  cue points on the old ScrollyCanvas (story frames 25 and 79). */
const DHAK_TIMES_S = [1, 3] as const;
/** Game-show theme arms at this video timestamp (seconds). Mirrors the
 *  legacy theme-start point at story frame 117. */
const THEME_CUE_S = 6;
/** Window-level event GameFlow listens for to arm + unlock the theme. */
export const HOME_VIDEO_THEME_EVENT = "homevideo:theme-cue";

/**
 * HomeIntroVideo
 * ─────────────────────────────────────────────────────────────────
 * Replaces the legacy ScrollyCanvas (frame-by-frame scroll-driven
 * animation) on the home page. After the user clicks "Continue with
 * sound" on the AudioPrimingGate, this video plays ONCE.
 *
 * Implementation notes:
 *   - The <video> tag has NO `autoPlay` attribute (per spec). We
 *     start playback programmatically via `.play()` once
 *     `audioUnlocked` flips true — that flip is gated on the user's
 *     gesture inside AudioPrimingGate, so browsers honour the play
 *     request without rejecting it as unauthorised autoplay.
 *   - `loop={false}` + a guard ref prevents replay if the effect
 *     fires more than once for any reason.
 *   - `muted={false}` so the video's own audio plays alongside the
 *     experience (audio context is already unlocked).
 *
 * The GameFlow "Enter" button is rendered separately (over the top
 * of this video) by GameFlow itself, so this component is ONLY the
 * background video layer — no UI of its own.
 */
export default function HomeIntroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playedRef = useRef(false);
  /** Tracks which one-shot cues have already fired so seek-back / repeated
   *  timeupdate events can't re-trigger them. Indexes correspond to
   *  DHAK_TIMES_S; the last slot is the theme cue. */
  const cuesFiredRef = useRef<{ dhak: boolean[]; theme: boolean }>({
    dhak: DHAK_TIMES_S.map(() => false),
    theme: false,
  });
  const { audioUnlocked } = useNarration();

  /** Play the dhak one-shot — fresh Audio per hit so they can overlap and
   *  garbage collect without us managing a pool. */
  const playDhakHit = () => {
    try {
      const a = new Audio(DHAK_SRC);
      a.volume = 0.9;
      void a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    DHAK_TIMES_S.forEach((cueT, idx) => {
      if (!cuesFiredRef.current.dhak[idx] && t >= cueT) {
        cuesFiredRef.current.dhak[idx] = true;
        playDhakHit();
      }
    });
    if (!cuesFiredRef.current.theme && t >= THEME_CUE_S) {
      cuesFiredRef.current.theme = true;
      // Tell GameFlow to arm + unlock the game-show theme. Window-level
      // event so we don't have to thread a callback prop through page.tsx.
      try {
        window.dispatchEvent(new CustomEvent(HOME_VIDEO_THEME_EVENT));
      } catch {
        /* ignore — older browsers without CustomEvent constructor */
      }
    }
  };

  useEffect(() => {
    if (!audioUnlocked) return;
    const v = videoRef.current;
    if (!v) return;
    if (playedRef.current) return;
    playedRef.current = true;
    // Reset to the first frame in case the element was paused mid-stream
    // by a prior unmount; play() returns a Promise we just swallow on
    // failure (which would only happen if the user's browser rejects
    // even the gestured play, e.g. rare codec-not-supported case).
    try {
      v.currentTime = 0;
    } catch {
      /* ignore */
    }
    void v.play().catch(() => {
      // If the browser still refuses (e.g. codec issue), unlock the
      // played guard so a later trigger (e.g. user gesture) can retry.
      playedRef.current = false;
    });
  }, [audioUnlocked]);

  return (
    <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={HOME_VIDEO_SRC}
        // Per spec: no autoPlay, no loop. Plays once on the audio-unlock
        // gesture and then stays on its final frame.
        loop={false}
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden
      />
    </div>
  );
}
