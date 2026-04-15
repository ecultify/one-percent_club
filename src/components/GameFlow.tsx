"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import UserDetailsModal from "./UserDetailsModal";
import Instructions from "./Instructions";
import QuizGame from "./QuizGame";
import StatsIntro from "./StatsIntro";
import { useNarration } from "./NarrationProvider";

const Logo3D = dynamic(() => import("./Logo3D"), { ssr: false });

type Phase =
  | "idle"
  | "ripple"
  | "logo-enter"       // appears at center, scales up
  | "logo-center"      // centered, spinning while model loads
  | "logo-fly-corner"  // center → top-left corner
  | "stats-intro"      // dhak-dhak stats reveal (100 players / 7 Qs / ₹1 Cr)
  | "welcome-video"    // fullscreen welcome video plays
  | "post-video-gate"  // "Start the game" button — user gesture to unlock audio
  | "details"
  | "instructions"
  | "playing";

interface PlayerData {
  name: string;
  phone: string;
  email: string;
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
      // Top-left corner, small
      corner: {
        x: 10,
        y: 10,
        scale: 110 / LOGO_SIZE,
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
  const [phase, setPhase] = useState<Phase>("idle");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [showButton, setShowButton] = useState(false);
  const [rippleOrigin, setRippleOrigin] = useState({ x: 0, y: 0 });
  const [logoModelReady, setLogoModelReady] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Refs for stale-closure-safe access in setTimeout chains
  const modelReadyRef = useRef(false);
  const pendingFlyToCorner = useRef(false);

  const positions = useLogoPositions();
  const { unlock: unlockAudio } = useNarration();

  useEffect(() => { modelReadyRef.current = logoModelReady; }, [logoModelReady]);

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

  const { scrollYProgress } = useScroll();
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (phase === "idle") setShowButton(v > 0.75);
  });

  const flyToCorner = useCallback(() => {
    setPhase("logo-fly-corner");
    // Wait for fly animation (1.4s) to finish, then run the dhak-dhak stats intro
    setTimeout(() => setPhase("stats-intro"), 1500);
  }, []);

  const handleStatsIntroComplete = useCallback(() => {
    setPhase("welcome-video");
  }, []);

  const handleVideoEnd = useCallback(() => {
    setPhase("post-video-gate");
  }, []);

  const handleEnterGame = useCallback(() => {
    // Critical: this click is a fresh user gesture.
    // Unlock audio NOW so the details screen narration autoplays.
    unlockAudio();
    setPhase("details");
  }, [unlockAudio]);

  // When model loads while we're at center, wait 3.5s to admire, then fly
  useEffect(() => {
    if (logoModelReady && pendingFlyToCorner.current) {
      pendingFlyToCorner.current = false;
      setTimeout(() => flyToCorner(), 3500);
    }
  }, [logoModelReady, flyToCorner]);

  const handleStart = useCallback(() => {
    // Unlock audio now — this is our only guaranteed user gesture for autoplay
    unlockAudio();

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setRippleOrigin({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    setPhase("ripple");

    // After ripple has mostly filled, show logo at center (ripple duration is 4.5s)
    setTimeout(() => {
      setPhase("logo-enter");

      // After scale-up animation (1.2s), mark as centered
      setTimeout(() => {
        setPhase("logo-center");

        // Check model readiness via ref
        setTimeout(() => {
          if (modelReadyRef.current) {
            // Model already ready: hold at center for 3.5s then fly to corner
            setTimeout(() => flyToCorner(), 3500);
          } else {
            // Model still loading, will trigger via useEffect when ready
            pendingFlyToCorner.current = true;
          }
        }, 200);
      }, 1200);
    }, 3200);
  }, [flyToCorner, unlockAudio]);

  const handleDetailsSubmit = useCallback((data: PlayerData) => {
    setPlayer(data);
    setPhase("instructions");
  }, []);

  const handleBeginGame = useCallback(() => {
    setPhase("playing");
  }, []);

  const handleLogoReady = useCallback(() => {
    setLogoModelReady(true);
  }, []);

  const showStatsIntro = phase === "stats-intro";
  const showWelcomeVideo = phase === "welcome-video";
  const showPostVideoGate = phase === "post-video-gate";
  const showOverlay = phase === "details" || phase === "instructions" || phase === "playing";
  const showLogo = phase === "logo-enter" || phase === "logo-center" || phase === "logo-fly-corner" || showStatsIntro || showWelcomeVideo || showPostVideoGate || showOverlay;

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
      case "stats-intro":
      case "welcome-video":
      case "post-video-gate":
      case "details":
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
        // Smooth, unhurried fly to corner
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
            transition={{ duration: 0.4, ease: EASE_OUT }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            className="fixed bottom-10 right-10 md:bottom-12 md:right-14 z-30 cursor-pointer group"
          >
            <div className="absolute -inset-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div
                className="w-full h-full rounded-full border border-brass/25"
                style={{ animation: "pulse-ring 2.2s ease-out infinite" }}
              />
            </div>
            <div className="absolute -inset-8 rounded-full bg-brass/12 blur-3xl group-hover:bg-brass/20 transition-all duration-500" />
            <div className="absolute -inset-px rounded-full ring-1 ring-white/10 group-hover:ring-brass/40 transition-all duration-300" />
            <div className="relative w-[150px] h-[150px] rounded-full overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)]">
              <img src="/club-logo.png" alt="The 1% Club" className="w-full h-full object-cover scale-150" />
              <div className="absolute inset-0 bg-black/35 group-hover:bg-black/15 transition-colors duration-300 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="ml-1 text-foreground/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" aria-hidden>
                  <path d="M8 5.14v13.72a1 1 0 001.5.86l11.04-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z" fill="currentColor" />
                </svg>
              </div>
            </div>
            <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.48em] text-muted whitespace-nowrap">
              Enter
            </span>
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

      {/* ━━ 3D Logo ━━ */}
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

            {/* Corner glow when settled */}
            {(phase === "logo-fly-corner" || showStatsIntro || showWelcomeVideo || showOverlay) && logoModelReady && (
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

      {/* ━━ Stats Intro (dhak-dhak-dhak) ━━ */}
      <AnimatePresence>
        {showStatsIntro && (
          <StatsIntro key="stats-intro" onComplete={handleStatsIntroComplete} />
        )}
      </AnimatePresence>

      {/* ━━ Welcome Video ━━ */}
      <AnimatePresence>
        {showWelcomeVideo && (
          <motion.div
            key="welcome-video"
            className="fixed inset-0 z-[65] bg-black flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_SMOOTH }}
          >
            <video
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              onEnded={handleVideoEnd}
              src="/welcome-video.mp4"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━ Post-Video Gate (Start the Game button — unlocks audio for narration) ━━ */}
      <AnimatePresence>
        {showPostVideoGate && (
          <motion.div
            key="post-video-gate"
            className="fixed inset-0 z-[62] flex items-center justify-center bg-[var(--background)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_SMOOTH }}
          >
            {/* Ambient atmosphere */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,720px)] h-[min(90vw,720px)] rounded-full bg-brass/[0.14] blur-[100px]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_55%_at_50%_-15%,rgba(255,220,140,0.18),rgba(196,160,53,0.09)_38%,transparent_68%)]" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
              className="relative text-center px-6 max-w-lg"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.55em] text-brass-dim/90 mb-6">
                The stage is set
              </p>
              <div className="mx-auto mb-8 h-px w-16 bg-gradient-to-r from-transparent via-brass/50 to-transparent" />
              <h2 className="font-display text-[clamp(2.25rem,7vw,4rem)] font-semibold leading-[1] tracking-[-0.03em] text-foreground mb-6">
                Ready to play?
              </h2>
              <p className="text-foreground/65 text-base md:text-lg leading-relaxed mb-10 max-w-sm mx-auto">
                Click below to begin. Your host will guide you through the next step.
              </p>
              <motion.button
                onClick={handleEnterGame}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="game-show-btn relative z-0 cursor-pointer rounded-xl bg-brass px-10 py-4 text-center text-[13px] font-semibold uppercase tracking-[0.25em] text-[#14110a] transition-colors hover:bg-brass-bright shadow-[0_20px_50px_-15px_rgba(196,160,53,0.5)]"
              >
                <span className="relative z-10">Start the game</span>
              </motion.button>
            </motion.div>
          </motion.div>
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
            <div className="absolute inset-0">
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

            {phase === "details" && (
              <motion.div
                key="det"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: EASE_OUT }}
                className="relative w-full h-full flex items-center justify-center"
              >
                <UserDetailsModal onSubmit={handleDetailsSubmit} />
              </motion.div>
            )}

            {phase === "instructions" && (
              <motion.div
                key="inst"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="relative w-full h-full flex items-center justify-center"
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
                className="relative w-full h-full"
              >
                <QuizGame
                  playerName={player?.name || "Player"}
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
