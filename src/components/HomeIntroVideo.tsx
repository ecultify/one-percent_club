"use client";

import { useEffect, useRef, useState } from "react";
import { useNarration } from "./NarrationProvider";

const HOME_VIDEO_SRC = "/questionscreenimages/FullVIDF2.mp4";
const HOME_VIDEO_POSTER = "/questionscreenimages/FullVIDF2.mp4.poster.jpg";
const LOOP_VIDEO_SRC = "/questionscreenimages/LastVid2.mp4";
const LOOP_VIDEO_POSTER = "/questionscreenimages/LastVid2.mp4.poster.jpg";
const DHAK_SRC = "/sound/dhak.wav";
/** Mobile (portrait-phone) replacement for the intro video: a static
 *  9:16 hero still. On phones we skip the FullVIDF2 video entirely — no
 *  dhak stingers, no timed cues — and just show this image the instant the
 *  audio gate is dismissed.
 *
 *  Shares the /play sound gate's portrait key-art so the Enter screen and the
 *  join link open on the same "India Ke Top 1%" art. The retired
 *  questionscreenimages/home-intro-mobile.png still carried the older
 *  "The 1% Club" branding. */
const HOME_IMAGE_MOBILE_SRC = "/play-gate-mobile.webp";

/** Dhak hits at these video timestamps (seconds). Tightened sequence per
 *  Abhinav's call: dhak #1 fires at the video start (T=0), dhak #2 fires
 *  3s later. Both use the same dhak.wav clip — the second one is "the
 *  other one" in the spec. */
const DHAK_TIMES_S = [0, 3] as const;
/** Game-show theme arms at this video timestamp (seconds). The theme drops
 *  ~1.5s after the second dhak hit, giving the audience a clean
 *  dhak → dhak → theme rhythm. NOTE: this MUST land inside the intro video's
 *  duration — the cue fires from `timeupdate`, so a value past the end never
 *  fires during playback (the `handleEnded` fallback below catches that case).
 *  The current FullVIDF2.mp4 is ~5s, so this sits comfortably before the end. */
const THEME_CUE_S = 4.5;
/** Absolute timestamp (seconds) at which the Enter CTA fades in. Concurrent
 *  with THEME_CUE_S so the theme drop and the button reveal land together —
 *  one beat, two events. (Previously the button waited until 2s before the
 *  end of the intro video, which made the user sit through the full clip
 *  before they could proceed.) */
const ENTER_CUE_AT_S = 4.5;
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
/** True on a phone-sized viewport (<768px). Drives the static-image swap. */
function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

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
  const isMobile = useIsMobileViewport();
  const mobileCuesFiredRef = useRef(false);

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
    // Safety net: if the intro video is shorter than THEME_CUE_S / ENTER_CUE_AT_S
    // (e.g. after a shorter video is swapped in), those timeupdate cues never
    // reach their timestamp and the theme would silently never arm. Fire any
    // unfired cue here so the music + CTA always land by the time the clip ends.
    if (!cuesFiredRef.current.theme) {
      cuesFiredRef.current.theme = true;
      try {
        window.dispatchEvent(new CustomEvent(HOME_VIDEO_THEME_EVENT));
      } catch {
        // ignore
      }
    }
    if (!cuesFiredRef.current.enter) {
      cuesFiredRef.current.enter = true;
      try {
        window.dispatchEvent(new CustomEvent(HOME_VIDEO_ENTER_EVENT));
      } catch {
        // ignore
      }
    }
    // ─── Looping background video DISABLED ────────────────────────────────
    // The LastVid2.mp4 loop was a continuously-active second decoder running
    // alongside the quiz videos and was contributing to mid-playback stutter.
    // We now let the main intro video hold on its final frame instead. The
    // loopVideoRef + <video> element below are commented out together.
    // ──────────────────────────────────────────────────────────────────────
    // const loop = loopVideoRef.current;
    // if (loop) {
    //   try {
    //     loop.currentTime = 0;
    //   } catch {
    //     // ignore
    //   }
    //   void loop.play().catch(() => {
    //     // ignore
    //   });
    // }
    // setLoopActive(true);
  };

  useEffect(() => {
    if (isMobile) return; // mobile shows a static image — no video to play
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
  }, [audioUnlocked, isMobile]);

  // Mobile: the static image replaces the timed intro video, so there's no
  // timeupdate to drive the cues. Once audio unlocks, fire the theme + Enter
  // cues together after a short beat (so the music drop and the button reveal
  // land on the same moment) — and deliberately NO dhak stingers.
  useEffect(() => {
    if (!isMobile) return;
    if (!audioUnlocked) return;
    if (mobileCuesFiredRef.current) return;
    mobileCuesFiredRef.current = true;
    const t = setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent(HOME_VIDEO_THEME_EVENT));
        window.dispatchEvent(new CustomEvent(HOME_VIDEO_ENTER_EVENT));
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(t);
  }, [isMobile, audioUnlocked]);

  return (
    <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden bg-black">
      {isMobile ? (
        // Mobile: static 9:16 hero still in place of the intro video.
        <img
          src={HOME_IMAGE_MOBILE_SRC}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover object-center"
        />
      ) : (
        <video
          ref={videoRef}
          src={HOME_VIDEO_SRC}
          poster={HOME_VIDEO_POSTER}
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
      )}
      {/* ─── Looping background video DISABLED (perf) ──────────────────
          The LastVid2.mp4 loop was a continuously-active second decoder
          competing with the quiz-side videos for hardware decode slots,
          contributing to mid-playback stutter. The main FullVIDF2 video
          above now holds its last frame after onEnded fires (no swap to
          opacity 0, no second decoder).
          ────────────────────────────────────────────────────────────── */}
      {/*
      <video
        ref={loopVideoRef}
        src={LOOP_VIDEO_SRC}
        poster={LOOP_VIDEO_POSTER}
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
      */}
    </div>
  );
}
