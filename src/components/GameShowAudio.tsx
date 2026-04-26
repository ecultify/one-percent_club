"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { registerSecondaryAudioUnlock } from "@/lib/secondaryAudioUnlock";
import { useNarration } from "./NarrationProvider";

const THEME_SRC = encodeURI("/sound/The 1 Club Theme Tune - Twin Petes (1).mp3");

const VOL_NORMAL = 0.42;
/** BGM while host voice is requested but not on the bus yet (TTS fetch, or gap after pause). */
const VO_DUCK_INTENT = 0.1;
/** BGM when host TTS/VO is actually playing — duck a little more so dialogue stays clear. */
const VO_DUCK_SPEAKING = 0.055;
/** BGM during video clips (intros, reactions). Used to be silent (paused) — now we
 *  keep a quiet bed so the room doesn't go dead between phases. The video's own
 *  audio cuts through cleanly because this sits well below dialogue level. */
const VOL_VIDEO_BED = 0.08;
/** BGM during elimination sequence — slightly higher than video bed since
 *  there's no dialogue to compete with, but still ducked from normal. */
const VOL_SLOW_MODE = 0.13;
/** Playback rate during elimination — slower tempo for tension. */
const RATE_SLOW_MODE = 0.85;

/**
 * One shared HTMLAudioElement for the game-show bed for the whole app lifetime.
 * Creating a new `Audio()` per mount (and especially after cleanup `src = ""`) can
 * leave multiple decoded streams / elements in a bad state; on tab return, retry
 * logic + a second `play()` then stacks two loops. A singleton prevents that.
 */
let gameShowThemeSingleton: HTMLAudioElement | null = null;
function getGameShowThemeElement(): HTMLAudioElement {
  if (typeof window === "undefined") {
    throw new Error("getGameShowThemeElement is browser-only");
  }
  if (!gameShowThemeSingleton) {
    const el = new Audio(THEME_SRC);
    el.loop = true;
    el.preload = "auto";
    gameShowThemeSingleton = el;
  }
  return gameShowThemeSingleton;
}

type GameShowAudioProps = {
  /** When true, theme can play (still respects video suppression). */
  playBgm: boolean;
  /** Pause theme entirely (welcome video, question intros, reaction clips, etc.). */
  suppressForVideo: boolean;
  /** When true, BGM ducks to a quiet bed AND slows tempo via playbackRate.
   *  Used during the elimination sequence so the music underscores the moment
   *  without overpowering the elimination stinger / coin tinks. */
  slowMode?: boolean;
  /**
   * Receives `unlockAudible` — used if the browser rejects *audible* autoplay on load.
   * (Some sessions still require any tap / key once — we try without that first.)
   */
  onThemeUnlockReady?: (unlockAudible: () => void) => void;
};

/**
 * Theme music: **tries audible autoplay the instant the component mounts** (useLayoutEffect).
 * Many browsers allow that on localhost, repeat visits, or when the user has unmuted the tab
 * before — but on a strict cold tab they may still block sound until a gesture. If `play()`
 * rejects, we fall back to muted playback and `unlockAudible` / pointer handlers restore volume.
 */
export default function GameShowAudio({
  playBgm,
  suppressForVideo,
  slowMode = false,
  onThemeUnlockReady,
}: GameShowAudioProps) {
  const { isSpeaking, hostVoiceDucksBgm } = useNarration();
  const ref = useRef<HTMLAudioElement | null>(null);
  /** True after audible autoplay succeeded OR after a successful gesture unlock. */
  const themeAudibleRef = useRef(false);
  const [playbackNonce, setPlaybackNonce] = useState(0);
  /** False until first autoplay attempt (audible or muted) has settled. */
  const [autoplaySettled, setAutoplaySettled] = useState(false);

  const unlockInFlightRef = useRef(false);
  /** Latest props for gesture / unlock paths (avoid stale closures). */
  const playBgmRef = useRef(playBgm);
  const suppressRef = useRef(suppressForVideo);
  const isSpeakingRef = useRef(isSpeaking);
  const hostVoiceDucksBgmRef = useRef(hostVoiceDucksBgm);
  const syncBgmRef = useRef<() => void>(() => {});

  /** User gestured while theme was disallowed — promote to audible once policy allows. */
  const pendingGestureUnlockRef = useRef(false);

  useEffect(() => {
    playBgmRef.current = playBgm;
    suppressRef.current = suppressForVideo;
  }, [playBgm, suppressForVideo]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    hostVoiceDucksBgmRef.current = hostVoiceDucksBgm;
  }, [isSpeaking, hostVoiceDucksBgm]);

  const unlockAudible = useCallback(() => {
    const el = ref.current;
    if (!el || unlockInFlightRef.current) return;

    const allowNow = playBgmRef.current && !suppressRef.current;
    if (!allowNow) {
      pendingGestureUnlockRef.current = true;
      return;
    }

    if (themeAudibleRef.current) return;

    pendingGestureUnlockRef.current = false;

    unlockInFlightRef.current = true;

    el.muted = false;
    el.volume = VOL_NORMAL;

    let settled = false;
    const settleOk = () => {
      if (settled) return;
      settled = true;
      unlockInFlightRef.current = false;
      themeAudibleRef.current = true;
      setPlaybackNonce((n) => n + 1);
    };
    const settleFail = () => {
      if (settled) return;
      settled = true;
      unlockInFlightRef.current = false;
      themeAudibleRef.current = false;
      el.muted = true;
      el.volume = 0;
      void el.play().catch(() => {});
    };

    const hangGuard = window.setTimeout(settleFail, 4000);

    const p = el.play();
    if (p && typeof p.then === "function") {
      void p
        .then(() => {
          window.clearTimeout(hangGuard);
          settleOk();
        })
        .catch(() => {
          window.clearTimeout(hangGuard);
          settleFail();
        });
    } else {
      window.clearTimeout(hangGuard);
      settleOk();
    }
  }, []);

  // First paint: attempt **audible** autoplay before user touches anything.
  useLayoutEffect(() => {
    const el = ref.current ?? getGameShowThemeElement();
    ref.current = el;
    if (!el) return;

    el.muted = false;
    el.volume = VOL_NORMAL;

    const finish = (audibleOk: boolean) => {
      themeAudibleRef.current = audibleOk;
      if (!audibleOk) {
        el.muted = true;
        el.volume = 0;
        void el.play().catch(() => {});
      }
      setAutoplaySettled(true);
      setPlaybackNonce((n) => n + 1);
    };

    const p = el.play();
    if (p && typeof p.then === "function") {
      void p.then(() => finish(true)).catch(() => finish(false));
    } else {
      finish(true);
    }
  }, []);

  const applyBgmState = useCallback(() => {
    const el = ref.current ?? getGameShowThemeElement();
    ref.current = el;
    if (!el) return;

    // Master gate: must have playBgm and NOT be in tab-background.
    // We no longer fully suppress on `suppressForVideo` — instead we keep a
    // quiet bed under the video so the room doesn't go dead, and so the
    // soundtrack stays continuous between phases.
    const allow = playBgm;

    if (allow && pendingGestureUnlockRef.current && !themeAudibleRef.current) {
      pendingGestureUnlockRef.current = false;
      queueMicrotask(() => {
        unlockAudible();
      });
      return;
    }

    if (!allow) {
      el.pause();
      el.playbackRate = 1;
      return;
    }

    // Tab in background: never stack play() on top of a still-running background decode.
    if (typeof document !== "undefined" && document.hidden) {
      el.pause();
      return;
    }

    if (!autoplaySettled) return;

    if (!themeAudibleRef.current) {
      el.muted = true;
      el.volume = 0;
      void el.play().catch(() => {});
      return;
    }

    el.muted = false;
    const duck = hostVoiceDucksBgmRef.current;
    const speaking = isSpeakingRef.current;
    if (suppressForVideo) {
      el.volume = VOL_VIDEO_BED;
      el.playbackRate = 1;
    } else if (slowMode) {
      // Elimination sequence: ducked + slow tempo for tension.
      el.volume = VOL_SLOW_MODE;
      el.playbackRate = RATE_SLOW_MODE;
    } else {
      el.volume = duck
        ? speaking
          ? VO_DUCK_SPEAKING
          : VO_DUCK_INTENT
        : VOL_NORMAL;
      el.playbackRate = 1;
    }

    // Idempotent: avoid redundant play() storms when many listeners fire on focus/visibility.
    if (el.paused) {
      void el.play().catch(() => {});
    }
  }, [playBgm, suppressForVideo, slowMode, autoplaySettled, unlockAudible]);

  syncBgmRef.current = applyBgmState;

  useEffect(() => {
    onThemeUnlockReady?.(unlockAudible);
  }, [onThemeUnlockReady, unlockAudible]);

  // Do NOT `src = ""` or drop the singleton — that can orphan a playing decode and the next
  // remount + play() stacks a second track. Only pause; element stays the single shared node.
  useEffect(() => {
    return () => {
      const el = ref.current;
      if (el) {
        el.pause();
      }
    };
  }, []);

  useEffect(() => {
    return registerSecondaryAudioUnlock(() => {
      unlockAudible();
    });
  }, [unlockAudible]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const onGesture = () => {
      unlockAudible();
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    document.addEventListener("pointerdown", onGesture, opts);
    document.addEventListener("touchstart", onGesture, opts);
    document.addEventListener("keydown", onGesture, opts);
    document.addEventListener("click", onGesture, opts);
    return () => {
      document.removeEventListener("pointerdown", onGesture, opts);
      document.removeEventListener("touchstart", onGesture, opts);
      document.removeEventListener("keydown", onGesture, opts);
      document.removeEventListener("click", onGesture, opts);
    };
  }, [unlockAudible]);

  /** When the tab is hidden, pause the bed. When visible again, one sync (no double play). */
  useEffect(() => {
    if (typeof document === "undefined") return;

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        const el = ref.current;
        if (el) {
          el.pause();
        }
        return;
      }
      requestAnimationFrame(() => {
        syncBgmRef.current();
      });
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    applyBgmState();
  }, [
    playBgm,
    suppressForVideo,
    slowMode,
    isSpeaking,
    hostVoiceDucksBgm,
    playbackNonce,
    autoplaySettled,
    applyBgmState,
  ]);

  return null;
}
