"use client";

import { useEffect, useRef, useState } from "react";
import { useNarration } from "./NarrationProvider";

const HOME_VIDEO_SRC = "/questionscreenimages/FullVIDF2.mp4";
const LOOP_VIDEO_SRC = "/questionscreenimages/LastVid2.mp4";
const DHAK_SRC = "/sound/dhak.wav";

/** Dhak hits at these video timestamps (seconds). Per spec: dhak fires
 *  twice during the first 12s, once at 4s and once at 8s. */
const DHAK_TIMES_S = [4, 8] as const;
/** Game-show theme arms at this video timestamp (seconds). Per spec:
 *  the Twin Petes theme drops at 12s into the home intro. */
const THEME_CUE_S = 12;
/** Lead time (seconds) before the video ends at which we tell GameFlow to
 *  surface the Enter CTA. Picked so the button's existing fade-in finishes
 *  right around the moment the video lands on its final frame and the
 *  loop video takes over. */
const ENTER_CUE_LEAD_S = 2.0;
/** Crossfade duration (seconds) when handing off from the main intro
 *  video to the looping idle video. Short, just enough to mask the cut
 *  without feeling laggy. */
const CROSSFADE_S = 0.4;
/** Window-level event GameFlow listens for to arm + unlock the theme. */
export const HOME_VIDEO_THEME_EVENT = "homevideo:theme-cue";
/** Window-level event GameFlow listens for to fade the Enter button in
 *  during the home intro video's tail. */
export const HOME_VIDEO_ENTER_EVENT = "homevideo:enter-cue";

/**
 * HomeIntroVideo
 * After "Continue with sound" on the AudioPrimingGate:
 *   1. FullVIDF2.mp4 plays ONCE.
 *      - At 4s and 8s: dhak.wav stinger fires.
 *      - At 12s: game-show theme is armed (HOME_VIDEO_THEME_EVENT).
 *      - 2s before end: Enter CTA fades in (HOME_VIDEO_ENTER_EVENT).
 *   2. When FullVIDF2 ends, we crossfade to LastVid2.mp4 which loops
 *      indefinitely until the user clicks Enter.
 */
export default function HomeIntroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopVideoRef = useRef<HTMLVideoElement | null>(null);
  const playedRef = useRef(false);
  const cuesFiredRef = useRef<{ dhak: boolean[]; theme: boolean; enter: boolean }>({
    dhak: DHAK_TIMES_S.map(() => false),
    theme: false,
    enter: false,
  });
  const { audioUnlocked } = useNarration();
  const [loopActive, setLoopActive] = useState(false);

  const playDhakHit = () => {
    try {
      const a = new Audio(DHAK_SRC);
      a.volume = 0.9;
      void a.play().catch(() => {});
    } catch {
      // ignore
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
      try {
        window.dispatchEvent(new CustomEvent(HOME_VIDEO_THEME_EVENT));
      } catch {
        // ignore
      }
    }
    const dur = e.currentTarget.duration;
    if (
      !cuesFiredRef.current.enter &&
      Number.isFinite(dur) &&
      dur > 0 &&
      dur - t <= ENTER_CUE_LEAD_S
    ) {
      cuesFiredRef.current.enter = true;
      try {
        window.dispatchEvent(new CustomEvent(HOME_VIDEO_ENTER_EVENT));
      } catch {
        // ignore
      }
    }
  };

  const handleEnded = () => {
    if (!cuesFiredRef.current.enter) {
      cuesFiredRef.current.enter = true;
      try {
        window.dispatchEvent(new CustomEvent(HOME_VIDEO_ENTER_EVENT));
      } catch {
        // ignore
      }
    }
    const loop = loopVideoRef.current;
    if (loop) {
      try {
        loop.currentTime = 0;
      } catch {
        // ignore
      }
      void loop.play().catch(() => {
        // ignore
      });
    }
    setLoopActive(true);
  };

  useEffect(() => {
    if (!audioUnlocked) return;
    const v = videoRef.current;
    if (!v) return;
    if (playedRef.current) return;
    playedRef.current = true;
    try {
      v.currentTime = 0;
    } catch {
      // ignore
    }
    void v.play().catch(() => {
      playedRef.current = false;
    });
  }, [audioUnlocked]);

  return (
    <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={HOME_VIDEO_SRC}
        loop={false}
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: loopActive ? 0 : 1,
          transition: `opacity ${CROSSFADE_S}s ease-in-out`,
        }}
        aria-hidden
      />
      <video
        ref={loopVideoRef}
        src={LOOP_VIDEO_SRC}
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: loopActive ? 1 : 0,
          transition: `opacity ${CROSSFADE_S}s ease-in-out`,
          pointerEvents: "none",
        }}
        aria-hidden
      />
    </div>
  );
}
