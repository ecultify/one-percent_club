"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import UserDetailsModal, { type QuizSet } from "./UserDetailsModal";
import MuteButton from "./MuteButton";
import { METALLIC_RIM_GRADIENT, PANEL_INNER_FILL } from "./QuestionScreen";
import Instructions from "./Instructions";
import QuizGame from "./QuizGame";
import ReadyToPlayGate from "./ReadyToPlayGate";
import GameShowAudio from "./GameShowAudio";
import FlowBackButton from "./FlowBackButton";
import { useNarration } from "./NarrationProvider";
import { warmClubLogoGlbAsset } from "@/lib/warmClubLogoAsset";
import { useVideoAutoplay } from "@/lib/useVideoAutoplay";
import { useScrollScrolly } from "@/contexts/ScrollScrollyContext";

const Logo3D = dynamic(() => import("./Logo3D"), { ssr: false });

/** Studio backdrop for registration (details) + instructions — rendered blurred beneath the content. */
const DETAILS_INSTRUCTIONS_BG = `/questionscreenimages/${encodeURIComponent("Gemini_Generated_Image_i8attui8attui8at-ezremove.png")}`;

/** Teaser that plays after the scrolly canvas / Start Experience. File hosted on
 *  ecultify.com; requested as `/teaser-video.mp4` and proxied in next.config.mjs so
 *  playback is same-origin and avoids CORS on `<video>`. */
const WELCOME_VIDEO_SRC = "/teaser-video.mp4";

const DHAK_SRC = "/sound/dhak.wav";
/** Story frames 25 and 79 (1-based) → zero-based scrolly indices. */
const DHAK_MILESTONES_0 = [24, 78] as const;
/** Twin Petes theme starts at story frame 117 (1-based). */
const THEME_START_SCROLL_FRAME_0 = 116;

function playDhakHit() {
  try {
    const hit = new Audio(DHAK_SRC);
    hit.volume = 0.9;
    void hit.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

type Phase =
  | "idle"
  | "ripple"
  | "logo-enter"       // appears at center, scales up
  | "logo-center"      // centered, spinning while model loads
  | "logo-fly-corner"  // center → top-center of the navbar
  | "welcome-video"    // fullscreen welcome video plays
  | "post-video-gate"  // "Start the game" button — user gesture to unlock audio
  | "details"
  | "coming-soon"
  | "instructions"
  | "playing";

interface PlayerData {
  name: string;
  quizSet: QuizSet;
}

// GPU-accelerated easing curves
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_SETTLE = [0.32, 0.72, 0, 1] as const;
const EASE_SMOOTH = [0.25, 0.46, 0.45, 0.94] as const;

// Logo base size (fixed, we use scale to change apparent size)
const LOGO_SIZE = 300;

/** Delayed loading text, positioned below center (below the logo) */
function DelayedLoadingText() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed z-[55] pointer-events-none" style={{ top: "calc(50vh + 180px)", left: 0, right: 0 }}>
      <motion.p
        className="font-mono text-brass-dim/80 text-[10px] uppercase tracking-[0.5em] text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.35, 0.85, 0.35] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        Loading the experience
      </motion.p>
    </div>
  );
}

/** Calculate pixel positions for each phase based on window size */
function useLogoPositions() {
  const [positions, setPositions] = useState(() => calcPositions());

  function calcPositions() {
    const w = typeof window !== "undefined" ? window.innerWidth : 1440;
    const h = typeof window !== "undefined" ? window.innerHeight : 900;
    const half = LOGO_SIZE / 2;

    return {
      // Bottom-right, small
      start: {
        x: w - 120,
        y: h - 120,
        scale: 0.2,
      },
      // Center of screen
      center: {
        x: w / 2 - half,
        y: h / 2 - half,
        scale: 1,
      },
      // Top-LEFT navbar brand mark. Visual width ≈ LOGO_SIZE * scale (LOGO_SIZE = 300).
      // Slightly larger than the old 110px so the GLB stays legible on wide stages.
      corner: {
        x: 16,
        y: 10,
        scale: 152 / LOGO_SIZE,
      },
    };
  }

  useEffect(() => {
    const handleResize = () => setPositions(calcPositions());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return positions;
}

export default function GameFlow() {
  const { scrollyFrameIndex } = useScrollScrolly();
  const [idleScrollThemeArmed, setIdleScrollThemeArmed] = useState(false);
  const prevScrollyFrameRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  /** `next dev` only: set by Ctrl+Shift+Y to mount QuizGame on the perfect-score end screen. */
  const [devChampionPreview, setDevChampionPreview] = useState(false);
  /** Remounts `QuizGame` after exiting to the instructions screen. */
  const [quizSessionKey, setQuizSessionKey] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [rippleOrigin, setRippleOrigin] = useState({ x: 0, y: 0 });
  const [logoModelReady, setLogoModelReady] = useState(false);
  // Set to true while ANY full-screen video overlay is rendering (welcome video
  // here, question-intro + reaction videos inside QuizGame). Used to hide the
  // 3D logo container so it can't peek through during the video's enter/exit
  // fade — which was happening because the logo sits at z-[85] and the video
  // containers fade opacity 0↔1 at z-[95].
  const [videoOverlayActive, setVideoOverlayActive] = useState(false);
  /** True when QuizGame is on the ending video or final-result summary screen.
   *  We use this to hide the persistent top-left 3D logo on the final screen
   *  so the centerpiece JSON animation is the sole brand mark. */
  const [finalScreenActive, setFinalScreenActive] = useState(false);
  /** True ONLY during reaction videos (correct/wrong/winner) — not during
   *  question-intro videos. Drives BGM suppression so AK question delivery
   *  keeps the theme bed underneath, but reaction stings get a clean stage. */
  const [reactionVideoActive, setReactionVideoActive] = useState(false);
  /** True while the question-screen countdown is actively ticking. Pauses the
   *  theme so the ITV timer bed (QuizGame) takes over. */
  const [questionTimerActive, setQuestionTimerActive] = useState(false);
  /** Post-answer (incl. reaction wait) + elimination UI until "Next question". */
  const [eliminationSequenceActive, setEliminationSequenceActive] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const welcomeVideoRef = useRef<HTMLVideoElement>(null);
  const themeUnlockRef = useRef<(() => void) | null>(null);

  // Refs for stale-closure-safe access in setTimeout chains
  const modelReadyRef = useRef(false);
  const pendingFlyToCorner = useRef(false);
  /** Bumped to invalidate pending intro `setTimeout` chains when the user returns to the scrolly. */
  const flowRunIdRef = useRef(0);
  /** `QuizGame` registers how to go back a step in-quiz, or to the previous flow screen. */
  const quizBackHandlerRef = useRef<(() => void) | null>(null);

  const positions = useLogoPositions();
  const { unlock: unlockAudio, prefetchAudioUrl, audioUnlocked } = useNarration();

  const handleThemeUnlockReady = useCallback((unlockTheme: () => void) => {
    themeUnlockRef.current = unlockTheme;
  }, []);

  useEffect(() => { modelReadyRef.current = logoModelReady; }, [logoModelReady]);

  // Warm Logo3D chunk + start full GLB decode (Draco) as soon as the page loads.
  // By the time the user scrolls to "Enter" / clicks, the mesh is often already in memory.
  useEffect(() => {
    void import("./Logo3D");
    warmClubLogoGlbAsset();
    void import("@/lib/logoModelPreload")
      .then((m) => m.preloadClubLogoModel())
      .catch((err) => console.warn("[GameFlow] club logo GLB preload failed:", err));
  }, []);

  // Reset scroll to top on every page load / reload — never land on the CTA frame
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  // Lock page scroll (and hide the right-side scrollbar) once the experience starts
  useEffect(() => {
    if (typeof document === "undefined") return;
    const locked = phase !== "idle";
    if (locked) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [phase]);

  // Home page is no longer scroll-driven (the legacy ScrollyCanvas was
  // replaced by HomeIntroVideo). The Enter button now fades in during the
  // home intro video's tail (the "homevideo:enter-cue" event fires ~2s
  // before the video ends), so the CTA is fully visible right around the
  // time the video lands on its final frame.
  //
  // We still pre-warm the 3D club-logo model the moment audio unlocks (so
  // it's ready in memory by the time the user actually clicks Enter), but
  // we no longer reveal the button on audio-unlock.
  useEffect(() => {
    if (phase !== "idle") return;
    if (!audioUnlocked) return;
    void import("@/lib/logoModelPreload")
      .then((m) => m.preloadClubLogoModel())
      .catch(() => {});
  }, [phase, audioUnlocked]);

  // Surface the Enter CTA when HomeIntroVideo signals it's near the end of
  // the home video. Window-level event keeps the contract loose so we don't
  // have to thread a callback through `app/page.tsx`.
  useEffect(() => {
    if (phase !== "idle") return;
    const HOME_VIDEO_ENTER_EVENT = "homevideo:enter-cue";
    const onCue = () => setShowButton(true);
    window.addEventListener(HOME_VIDEO_ENTER_EVENT, onCue);
    return () => window.removeEventListener(HOME_VIDEO_ENTER_EVENT, onCue);
  }, [phase]);

  // Theme cue: HomeIntroVideo dispatches "homevideo:theme-cue" at the
  // 6-second mark of the home video. We mirror what the legacy
  // scroll-frame trigger used to do — arm the idle theme + run the
  // GameShowAudio unlock — so the bed kicks in mid-intro instead of
  // waiting for the Enter click.
  useEffect(() => {
    if (phase !== "idle") return;
    const HOME_VIDEO_THEME_EVENT = "homevideo:theme-cue";
    const onCue = () => {
      setIdleScrollThemeArmed(true);
      themeUnlockRef.current?.();
    };
    window.addEventListener(HOME_VIDEO_THEME_EVENT, onCue);
    return () => window.removeEventListener(HOME_VIDEO_THEME_EVENT, onCue);
  }, [phase]);

  // Opening scroll: dhak on story frames 25 & 79; Twin Petes theme from frame 117 onward (idle only).
  useEffect(() => {
    if (phase !== "idle") {
      prevScrollyFrameRef.current = scrollyFrameIndex;
      return;
    }
    const prev = prevScrollyFrameRef.current;
    const f = scrollyFrameIndex;
    if (f > prev) {
      for (const m of DHAK_MILESTONES_0) {
        if (prev < m && f >= m) playDhakHit();
      }
      if (prev < THEME_START_SCROLL_FRAME_0 && f >= THEME_START_SCROLL_FRAME_0) {
        setIdleScrollThemeArmed(true);
        themeUnlockRef.current?.();
      }
    }
    prevScrollyFrameRef.current = f;
  }, [phase, scrollyFrameIndex]);

  const flyToCorner = useCallback((runId: number) => {
    if (flowRunIdRef.current !== runId) return;
    setPhase("logo-fly-corner");
    // Wait for fly animation (1.4s) to finish, then go straight to the welcome video.
    // (The pre-video "dhak-dhak" stats intro has been removed — stats now live only
    // on the post-video ReadyToPlayGate to avoid repetition.)
    setTimeout(() => {
      if (flowRunIdRef.current !== runId) return;
      setPhase("welcome-video");
    }, 1500);
  }, []);

  const handleVideoEnd = useCallback(() => {
    setPhase("post-video-gate");
  }, []);

  const handleEnterGame = useCallback(() => {
    // Finish the silent unlock *before* the details modal mounts so its
    // useEffect narrate() does not pause the handshake mid-flight (same for
    // instructions after form submit).
    void unlockAudio().then(() => setPhase("details"));
  }, [unlockAudio]);

  // When model loads while we're at center, wait 3.5s to admire, then fly
  useEffect(() => {
    if (logoModelReady && pendingFlyToCorner.current) {
      const runId = flowRunIdRef.current;
      pendingFlyToCorner.current = false;
      setTimeout(() => {
        if (flowRunIdRef.current !== runId) return;
        flyToCorner(runId);
      }, 3500);
    }
  }, [logoModelReady, flyToCorner]);

  const handleStart = useCallback(() => {
    const runId = ++flowRunIdRef.current;

    // Unlock audio now — this is our only guaranteed user gesture for autoplay
    unlockAudio();
    themeUnlockRef.current?.();

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setRippleOrigin({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    setPhase("ripple");

    // After ripple has mostly filled, show logo at center (ripple animation is 4.5s).
    // 2.4s keeps the beat without waiting so long that the GLB feels "stuck" if preload lagged.
    setTimeout(() => {
      if (flowRunIdRef.current !== runId) return;
      setPhase("logo-enter");

      // After scale-up animation (1.2s), mark as centered
      setTimeout(() => {
        if (flowRunIdRef.current !== runId) return;
        setPhase("logo-center");

        // Check model readiness via ref
        setTimeout(() => {
          if (flowRunIdRef.current !== runId) return;
          if (modelReadyRef.current) {
            // Model already ready: hold at center for 3.5s then fly to corner
            setTimeout(() => {
              if (flowRunIdRef.current !== runId) return;
              flyToCorner(runId);
            }, 3500);
          } else {
            // Model still loading, will trigger via useEffect when ready.
            pendingFlyToCorner.current = true;
            // Safety net: if the GLB genuinely fails to load (network blip,
            // decoder error, etc.) and Logo3D's own fallback doesn't trip,
            // don't leave the user stuck on the loading screen. After 8s at
            // logo-center we flip the flag ourselves so the flow advances.
            setTimeout(() => {
              if (flowRunIdRef.current !== runId) return;
              if (!modelReadyRef.current && pendingFlyToCorner.current) {
                console.warn("[GameFlow] 3D logo load timed out — advancing anyway");
                pendingFlyToCorner.current = false;
                setLogoModelReady(true); // will also trigger the fly-to-corner effect
              }
            }, 8000);
          }
        }, 200);
      }, 1200);
    }, 2400);
  }, [flyToCorner, unlockAudio]);

  const handleDetailsSubmit = useCallback(
    (data: PlayerData) => {
      setPlayer(data);
      if (data.quizSet === "B") {
        setPhase("coming-soon");
        return;
      }
      // Warm-cache instructions VO before Instructions mounts.
      void prefetchAudioUrl("/sound/howitworks1percentclub.mp3");
      void unlockAudio().then(() => setPhase("instructions"));
    },
    [unlockAudio, prefetchAudioUrl],
  );

  const handleBackFromComingSoon = useCallback(() => {
    setPlayer(null);
    setPhase("details");
  }, []);

  const handleBeginGame = useCallback(() => {
    setPhase("playing");
  }, []);

  const exitQuizToInstructions = useCallback(() => {
    setDevChampionPreview(false);
    setQuizSessionKey((k) => k + 1);
    quizBackHandlerRef.current = null;
    setPhase("instructions");
  }, []);

  const registerQuizBackHandler = useCallback((fn: (() => void) | null) => {
    quizBackHandlerRef.current = fn;
  }, []);

  const resetIntroToIdle = useCallback(() => {
    flowRunIdRef.current += 1;
    pendingFlyToCorner.current = false;
    setPhase("idle");
  }, []);

  const handleFlowBack = useCallback(() => {
    switch (phase) {
      case "ripple":
      case "logo-enter":
      case "logo-center":
      case "logo-fly-corner":
      case "welcome-video":
        resetIntroToIdle();
        break;
      case "post-video-gate":
        setPhase("welcome-video");
        break;
      case "details":
        setPhase("post-video-gate");
        break;
      case "instructions":
        setPhase("details");
        break;
      case "playing":
        if (quizBackHandlerRef.current) quizBackHandlerRef.current();
        else exitQuizToInstructions();
        break;
      default:
        break;
    }
  }, [phase, resetIntroToIdle, exitQuizToInstructions]);

  const showFlowBack = phase !== "idle" && phase !== "coming-soon";

  // `next dev` only: from welcome / stats gate / scrolly (Enter visible), go straight
  // to the champion end screen to preview confetti + applause.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const eligible =
      phase === "welcome-video" ||
      phase === "post-video-gate" ||
      (phase === "idle" && showButton);
    if (!eligible) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== "y") return;
      e.preventDefault();
      void unlockAudio();
      setPlayer({ name: "Champion (preview)", quizSet: "A" });
      setDevChampionPreview(true);
      setPhase("playing");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, showButton, unlockAudio]);

  const handleLogoReady = useCallback(() => {
    setLogoModelReady(true);
  }, []);

  const showWelcomeVideo = phase === "welcome-video";
  const showPostVideoGate = phase === "post-video-gate";

  /** Keep welcome teaser playing — autoplay can stall after heavy 3D work,
   *  tab switches, or a hard reload landing on bfcache. Shared hook so the
   *  same recovery logic runs for the question-intro and reaction overlays
   *  inside QuizGame. */
  useVideoAutoplay(welcomeVideoRef, showWelcomeVideo);

  /** Theme music choreography:
   *   - `idle`: theme only after scrolly story frame 117 (Twin Petes); dhak.wav on frames 25 & 79.
   *   - After Enter — through post-video ReadyToPlayGate — theme runs
   *     (muted until gesture, then audible). Pauses only during full-screen videos.
   *   - `details` + `instructions`: theme on; volume ducks while host narrates (`GameShowAudio` + `isSpeaking`).
   *   - `playing`: on for tour / intros; off during question-intro & reaction videos,
   *     off while the 30s question timer is live (ITV timer MP3), and off from
   *     answer lock-in through elimination (stinger + applause) until Next question. */
  const playBgm =
    (phase === "idle" && idleScrollThemeArmed) ||
    phase === "ripple" ||
    phase === "logo-enter" ||
    phase === "logo-center" ||
    phase === "logo-fly-corner" ||
    phase === "details" ||
    phase === "coming-soon" ||
    phase === "instructions" ||
    showPostVideoGate ||
    // BGM stays on during elimination too — GameShowAudio applies a slow-tempo
    // duck via the bgmSlowMode prop instead of muting completely.
    (phase === "playing" && !questionTimerActive);
  const bgmSuppressForVideo = showWelcomeVideo || reactionVideoActive;

  // Welcome video is controlled entirely by phase, so sync it here. Quiz-phase
  // videos (question-intro, reaction) are reported via QuizGame's callback.
  // IMPORTANT: when the welcome video unmounts we must keep the logo hidden
  // for the full AnimatePresence exit duration (0.6s), otherwise the logo
  // peeks through the fading-out video layer.
  useEffect(() => {
    if (showWelcomeVideo) {
      setVideoOverlayActive(true);
      return;
    }
    if (phase === "playing") return;
    const t = setTimeout(() => setVideoOverlayActive(false), 700);
    return () => clearTimeout(t);
  }, [phase, showWelcomeVideo]);
  const showOverlay =
    phase === "details" || phase === "coming-soon" || phase === "instructions" || phase === "playing";
  const showLogo =
    (phase === "ripple" ||
      phase === "logo-enter" ||
      phase === "logo-center" ||
      phase === "logo-fly-corner" ||
      showWelcomeVideo ||
      showPostVideoGate ||
      showOverlay) &&
    // On the final ending video and final-result summary, the centerpiece
    // JSON animation owns the brand mark — hide the persistent top-left logo.
    !finalScreenActive;

  // All GPU-accelerated: x, y, scale, opacity only
  const getLogoAnimateProps = () => {
    switch (phase) {
      case "logo-enter":
        // Appear at center, scale up from small
        return {
          x: positions.center.x,
          y: positions.center.y,
          scale: 1,
          opacity: 1,
        };
      case "logo-center":
        // Stay at center, full size
        return {
          x: positions.center.x,
          y: positions.center.y,
          scale: 1,
          opacity: 1,
        };
      case "logo-fly-corner":
      case "welcome-video":
      case "post-video-gate":
      case "details":
      case "coming-soon":
      case "instructions":
      case "playing":
        return {
          x: positions.corner.x,
          y: positions.corner.y,
          scale: positions.corner.scale,
          opacity: 1,
        };
      default:
        return {
          x: positions.center.x,
          y: positions.center.y,
          scale: 0,
          opacity: 0,
        };
    }
  };

  const getLogoTransition = () => {
    switch (phase) {
      case "logo-enter":
        // Scale up at center — smooth spring-like entrance
        return { duration: 1.2, ease: [0.16, 1, 0.3, 1] };
      case "logo-center":
        return { duration: 0.4, ease: EASE_OUT };
      case "logo-fly-corner":
        // Smooth, unhurried fly to the top-center navbar position
        return { duration: 1.4, ease: EASE_SETTLE };
      default:
        return { duration: 0.6, ease: EASE_SETTLE };
    }
  };

  return (
    <>
      {/* ━━ Play Button ━━ */}
      <AnimatePresence>
        {phase === "idle" && showButton && (
          <motion.button
            ref={buttonRef}
            key="play-btn"
            onClick={handleStart}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            // Slower fade-in (was 0.4s) so the CTA surfaces in step with
            // the tail of the home intro video instead of snapping in.
            transition={{ duration: 1.4, ease: EASE_OUT }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Enter experience"
            className="group fixed bottom-16 right-7 z-30 cursor-pointer sm:bottom-18 sm:right-9 md:bottom-20 md:right-11"
          >
            {/* Ambient brass halo — always on so the CTA reads from across the room */}
            <div
              className="pointer-events-none absolute -inset-7 rounded-full bg-amber-400/15 blur-2xl motion-safe:animate-[glow-pulse_2.8s_ease-in-out_infinite] md:-inset-9"
              aria-hidden
            />
            {/* Expanding ring — always visible (subtle); stronger on hover */}
            <div className="absolute -inset-3.5 rounded-full opacity-[0.45] transition-opacity duration-500 group-hover:opacity-90 md:-inset-4">
              <div
                className="h-full w-full rounded-full border border-brass/35"
                style={{ animation: "pulse-ring 2.2s ease-out infinite" }}
              />
            </div>
            <div className="absolute -inset-4 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:-inset-5">
              <div
                className="h-full w-full rounded-full border border-brass/50"
                style={{ animation: "pulse-ring 2.2s ease-out infinite" }}
              />
            </div>
            <div className="absolute -inset-8 rounded-full bg-brass/14 blur-[40px] transition-all duration-500 group-hover:bg-brass/24 md:-inset-10" />
            <div
              className="enter-cta-metallic-ring relative size-[min(168px,42vw)] sm:size-[min(178px,36vw)] md:size-[188px]"
            >
              <div className="relative z-0 flex size-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#1a0f1f] via-[#0d0608] to-[#1a1020] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35),inset_0_2px_12px_rgba(0,0,0,0.25)] transition-[box-shadow] duration-300 group-hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35),inset_0_2px_12px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(251,191,36,0.12)]">
                <span className="relative z-[3] px-[0.2em] pt-[0.08em] font-mono text-[clamp(1rem,3.4vw,1.45rem)] font-semibold uppercase tracking-[0.32em] text-brass-bright drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] md:tracking-[0.36em]">
                  Enter
                </span>
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ━━ Ripple ━━ */}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div key="ripple-bg" className="fixed inset-0 z-40 pointer-events-none">
            <motion.div
              className="absolute bg-[var(--background)]"
              style={{
                top: rippleOrigin.y,
                left: rippleOrigin.x,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
              }}
              initial={{ width: 0, height: 0 }}
              animate={{ width: "300vmax", height: "300vmax" }}
              transition={{ duration: 4.5, ease: [0.22, 0.61, 0.36, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━ Loading text ━━ */}
      {phase === "logo-center" && !logoModelReady && <DelayedLoadingText />}

      {/* ━━ 3D Logo ━━
          Wrapped in a plain <div> that flips to display:none during any
          full-screen video overlay. This is a hard removal from the layout —
          guaranteed to never peek through a fading video (stronger than
          visibility:hidden which framer-motion can shadow via style merging). */}
      <div style={{ display: videoOverlayActive ? "none" : "block" }}>
        <AnimatePresence>
          {showLogo && (
            <motion.div
              key="logo-3d-container"
              className="fixed z-[85] pointer-events-none origin-top-left"
              style={{
                top: 0,
                left: 0,
                width: LOGO_SIZE,
                height: LOGO_SIZE,
              }}
              initial={{
                x: positions.center.x,
                y: positions.center.y,
                scale: 0.15,
                opacity: 0,
              }}
              animate={getLogoAnimateProps()}
              transition={getLogoTransition()}
            >
              {/* Glow while at center */}
              {(phase === "logo-enter" || phase === "logo-center") && (
                <motion.div
                  className="absolute -inset-16 rounded-full bg-brass/20 blur-[80px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: logoModelReady ? 1 : 0.4 }}
                  transition={{ duration: 0.8 }}
                />
              )}

              {/* Corner glow when settled — not on details/instructions/playing (modal UIs read cleaner without a halo). */}
              {(phase === "logo-fly-corner" || showWelcomeVideo || phase === "post-video-gate") &&
                logoModelReady && (
                  <div className="absolute -inset-2 rounded-2xl bg-brass/12 blur-lg" />
                )}

              <Logo3D
                settled={phase !== "logo-enter" && phase !== "logo-center"}
                onReady={handleLogoReady}
                className="w-full h-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ━━ Welcome Video ━━ */}
      <AnimatePresence>
        {showWelcomeVideo && (
          <motion.div
            key="welcome-video"
            className="fixed inset-0 z-[95] bg-black flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_SMOOTH }}
          >
            <video
              ref={welcomeVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              preload="auto"
              onLoadedData={() => {
                void welcomeVideoRef.current?.play().catch(() => {});
              }}
              onCanPlay={() => {
                void welcomeVideoRef.current?.play().catch(() => {});
              }}
              onStalled={() => {
                void welcomeVideoRef.current?.play().catch(() => {});
              }}
              onWaiting={() => {
                void welcomeVideoRef.current?.play().catch(() => {});
              }}
              onEnded={handleVideoEnd}
              onError={handleVideoEnd}
              src={WELCOME_VIDEO_SRC}
            />
            {/* Skip button — bottom right, no other video controls visible */}
            <motion.button
              type="button"
              onClick={handleVideoEnd}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4, ease: EASE_OUT }}
              className="absolute bottom-6 right-6 md:bottom-8 md:right-10 z-[96] group flex items-center gap-2 rounded-full px-4 py-2 md:px-5 md:py-2.5 font-mono text-[11px] md:text-xs uppercase tracking-[0.32em] font-bold text-[#1a1105] cursor-pointer"
              style={{
                background:
                  "linear-gradient(180deg, #fff4c8 0%, #f9e89a 22%, #d9b446 50%, #a6801f 78%, #6d4e13 100%)",
                boxShadow:
                  "0 8px 22px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,252,220,0.85), inset 0 -1px 0 rgba(40,24,0,0.55)",
                textShadow:
                  "0 1px 0 rgba(255,246,200,0.7), 0 -1px 0 rgba(36,22,0,0.4)",
              }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              aria-label="Skip video"
            >
              <span>Skip</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 4l10 8-10 8V4z M17 4h2v16h-2z"
                  fill="currentColor"
                />
              </svg>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━ Post-Video Gate — full-screen ready layout + Start (unlocks audio for narration) ━━ */}
      <AnimatePresence>
        {showPostVideoGate && (
          <ReadyToPlayGate key="post-video-gate" onStart={handleEnterGame} />
        )}
      </AnimatePresence>

      {/* ━━ Overlay Content ━━ */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            key="overlay-content"
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            {(phase === "details" || phase === "coming-soon") && (
              <>
                {/* Blurred backdrop — registration only; instructions journey uses solid black in Instructions.tsx */}
                <img
                  src={DETAILS_INSTRUCTIONS_BG}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 z-0 h-full w-full min-h-full min-w-full object-cover object-center pointer-events-none select-none"
                  draggable={false}
                  style={{
                    filter: "blur(18px) saturate(115%)",
                    transform: "scale(1.08)",
                    transformOrigin: "center",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 z-[1] pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.48) 100%)",
                  }}
                />
              </>
            )}
            {phase === "instructions" && (
              <div
                aria-hidden
                className="absolute inset-0 z-0 bg-[#04020a] pointer-events-none"
              />
            )}

            {phase === "playing" && (
              <div className="absolute inset-0 z-[2]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,720px)] h-[min(90vw,720px)] rounded-full bg-brass/[0.12] blur-[100px]" />
                <div
                  className="absolute inset-0 opacity-[0.022]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                  }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_55%_at_50%_-15%,rgba(255,220,140,0.18),rgba(196,160,53,0.09)_38%,transparent_68%)]" />
                <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[min(100%,920px)] h-[min(48vh,440px)] bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(255,235,190,0.14),rgba(228,207,106,0.06)_42%,transparent_62%)] blur-[1px]" />
              </div>
            )}

            {phase === "details" && (
              <motion.div
                key="det"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: EASE_OUT }}
                className="relative z-10 w-full h-full flex items-center justify-center"
              >
                <UserDetailsModal onSubmit={handleDetailsSubmit} />
              </motion.div>
            )}

            {phase === "coming-soon" && (
              <motion.div
                key="coming-soon"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: EASE_OUT }}
                className="relative z-10 w-full h-full flex items-center justify-center p-4"
              >
                <div className="w-full max-w-md mx-4 flex flex-col relative">
                  <MuteButton />
                  <div
                    className="relative overflow-hidden rounded-2xl p-[2.5px] shadow-[0_36px_90px_-28px_rgba(0,0,0,0.72),0_0_28px_-4px_rgba(228,207,106,0.22)]"
                    style={{ background: METALLIC_RIM_GRADIENT }}
                  >
                    <div
                      className="relative overflow-hidden rounded-[13px] backdrop-blur-sm px-8 py-9 md:px-10 md:py-10 text-center"
                      style={PANEL_INNER_FILL}
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-brass-dim/90 mb-3">
                        Set B
                      </p>
                      <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-2">
                        Coming soon
                      </h2>
                      <p className="text-sm text-foreground/70 leading-relaxed mb-8 max-w-sm mx-auto">
                        This set isn&apos;t available yet. Try Set A to play the current experience, or
                        return to registration to choose again.
                      </p>
                      <motion.button
                        type="button"
                        onClick={handleBackFromComingSoon}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="game-show-btn relative z-0 w-full cursor-pointer rounded-xl py-4 text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-[#14110a]"
                      >
                        <span className="relative z-10">Back to registration</span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === "instructions" && (
              <motion.div
                key="inst"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="relative z-10 w-full h-full flex items-center justify-center"
              >
                <Instructions
                  playerName={player?.name || "Player"}
                  onStart={handleBeginGame}
                />
              </motion.div>
            )}

            {phase === "playing" && (
              <motion.div
                key="play"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 w-full h-full"
              >
                <QuizGame
                  key={quizSessionKey}
                  playerName={player?.name || "Player"}
                  devChampionPreview={devChampionPreview}
                  onBackToMenu={exitQuizToInstructions}
                  onRegisterBack={registerQuizBackHandler}
                  onVideoOverlayChange={setVideoOverlayActive}
                  onReactionVideoActiveChange={setReactionVideoActive}
                  onQuestionTimerActiveChange={setQuestionTimerActive}
                  onEliminationSequenceActiveChange={setEliminationSequenceActive}
                  onFinalScreenActiveChange={setFinalScreenActive}
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showFlowBack && <FlowBackButton onClick={handleFlowBack} />}

      <GameShowAudio
        playBgm={playBgm}
        suppressForVideo={bgmSuppressForVideo}
        slowMode={eliminationSequenceActive}
        onThemeUnlockReady={handleThemeUnlockReady}
      />
    </>
  );
}
