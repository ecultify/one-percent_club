"use client";

import { useEffect, useRef, useState } from "react";
import { useNarration } from "./NarrationProvider";

const HOME_VIDEO_SRC = "https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/FullVIDF2.mp4";
const LOOP_VIDEO_SRC = "https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/LastVid2.mp4";
const DHAK_SRC = "/sound/dhak.wav";

/** Dhak hits at these video timestamps (seconds). Tightened sequence per
 *  Abhinav's call: dhak #1 fires at the video start (T=0), dhak #2 fires
 *  3s later. Both use the same dhak.wav clip — the second one is "the
 *  other one" in the spec. */
const DHAK_TIMES_S = [0, 3] as const;
/** Game-show theme arms at this video timestamp (seconds). Tightened from
 *  T=12 to T=6 — the theme now drops 3s after the second dhak hit, giving
 *  the audience a clean dhak → dhak → theme rhythm in the first 6s. */
const THEME_CUE_S = 6;
/** Absolute timestamp (seconds) at which the Enter CTA fades in. Concurrent
 *  with THEME_CUE_S so the theme drop and the button reveal land together —
 *  one beat, two events. (Previously the button waited until 2s before the
 *  end of the intro video, which made the user sit through the full clip
 *  before they could proceed.) */
const ENTER_CUE_AT_S = 6;
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
 *      Audio sequence (compressed for impact):
 *        - T=0s: dhak.wav stinger #1
 *        - T=3s: dhak.wav stinger #2
 *        - T=6s: game-show theme arms (HOME_VIDEO_THEME_EVENT)
 *                AND Enter CTA fades in (HOME_VIDEO_ENTER_EVENT)
 *   2. When FullVIDF2 ends, we crossfade to LastVid2.mp4 which loops
 *      indefinitely until the user clicks Enter.
 *   3. After the Enter button is on screen for 5s without a click,
 *      `EnterButtonHint` (rendered by GameFlow) starts a repeating
 *      golden-cursor sweep from the bottom-left as a click hint.
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
    // Enter CTA reveals at the same absolute timestamp as the theme drop
    // (T=6s by default). Both events fire from a single tick of timeupdate
    // so the button reveal lands cleanly on the theme's downbeat.
    if (!cuesFiredRef.current.enter && t >= ENTER_CUE_AT_S) {
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
        preload="metadata"
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
