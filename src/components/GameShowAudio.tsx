"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { registerSecondaryAudioUnlock } from "@/lib/secondaryAudioUnlock";
import { useNarration } from "./NarrationProvider";

const THEME_SRC = encodeURI("/sound/The 1 Club Theme Tune - Twin Petes (1).mp3");

const VOL_NORMAL = 0.42;
const VO_DUCK = 0.09;

type GameShowAudioProps = {
  /** When true, theme can play (still respects video suppression). */
  playBgm: boolean;
  /** Pause theme entirely (welcome video, question intros, reaction clips, etc.). */
  suppressForVideo: boolean;
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
  onThemeUnlockReady,
}: GameShowAudioProps) {
  const { isSpeaking } = useNarration();
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
  /** User gestured while theme was disallowed — promote to audible once policy allows. */
  const pendingGestureUnlockRef = useRef(false);

  useEffect(() => {
    playBgmRef.current = playBgm;
    suppressRef.current = suppressForVideo;
  }, [playBgm, suppressForVideo]);

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

  // Create the Audio node on first client render so useLayoutEffect can play immediately.
  if (typeof window !== "undefined" && !ref.current) {
    const el = new Audio(THEME_SRC);
    el.loop = true;
    el.preload = "auto";
    ref.current = el;
  }

  // First paint: attempt **audible** autoplay before user touches anything.
  useLayoutEffect(() => {
    const el = ref.current;
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
  

  useEffect(() => {
    onThemeUnlockReady?.(unlockAudible);
    const el = ref.current;
    return () => {
      if (el) {
        el.pause();
        try {
          el.src = "";
        } catch {
          /* ignore */
        }
      }
      ref.current = null;
      themeAudibleRef.current = false;
    };
  }, [onThemeUnlockReady, unlockAudible]);

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const retry = () => {
      const el = ref.current;
      if (!el) return;
      if (el.paused) {
        void el.play().catch(() => {});
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") retry();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", retry);
    window.addEventListener("pageshow", retry);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", retry);
      window.removeEventListener("pageshow", retry);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const allow = playBgm && !suppressForVideo;

    if (allow && pendingGestureUnlockRef.current && !themeAudibleRef.current) {
      pendingGestureUnlockRef.current = false;
      queueMicrotask(() => {
        unlockAudible();
      });
      return;
    }

    if (!allow) {
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
    el.volume = isSpeaking ? VO_DUCK : VOL_NORMAL;
    void el.play().catch(() => {});
  }, [playBgm, suppressForVideo, isSpeaking, playbackNonce, autoplaySettled, unlockAudible]);

  return null;
}
