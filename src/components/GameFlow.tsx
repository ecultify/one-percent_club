"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import UserDetailsModal from "./UserDetailsModal";
import Instructions from "./Instructions";
import QuizGame from "./QuizGame";
import ReadyToPlayGate from "./ReadyToPlayGate";
import { useNarration } from "./NarrationProvider";
import { buildInstructionsNarration } from "./Instructions";
import { warmClubLogoGlbAsset } from "@/lib/warmClubLogoAsset";

const Logo3D = dynamic(() => import("./Logo3D"), { ssr: false });

/** Studio backdrop for registration (details) + instructions — rendered blurred beneath the content. */
const DETAILS_INSTRUCTIONS_BG = `/questionscreenimages/${encodeURIComponent("Gemini_Generated_Image_i8attui8attui8at-ezremove.png")}`;

/** Circular Enter button (idle phase) — filename uses narrow no-break space before "PM" (macOS screenshot default). */
const ENTER_BUTTON_IMAGE = `/questionscreenimages/${encodeURIComponent(
  "Screenshot 2026-04-16 at 1.47.21\u202fPM.png"
)}`;

/** Teaser that plays after the Start Experience button. Originally hosted on
 *  ecultify.com; served through a Next.js rewrite (see next.config.mjs) so the
 *  browser treats it as same-origin and skips the cross-origin CORS check. */
const WELCOME_VIDEO_SRC = "/teaser-video.mp4";

type Phase =
  | "idle"
  | "ripple"
  | "logo-enter"       // appears at center, scales up
  | "logo-center"      // centered, spinning while model loads
  | "logo-fly-corner"  // center → top-center of the navbar
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
  const [phase, setPhase] = useState<Phase>("idle");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [showButton, setShowButton] = useState(false);
  const [rippleOrigin, setRippleOrigin] = useState({ x: 0, y: 0 });
  const [logoModelReady, setLogoModelReady] = useState(false);
  // Set to true while ANY full-screen video overlay is rendering (welcome video
  // here, question-intro + reaction videos inside QuizGame). Used to hide the
  // 3D logo container so it can't peek through during the video's enter/exit
  // fade — which was happening because the logo sits at z-[85] and the video
  // containers fade opacity 0↔1 at z-[95].
  const [videoOverlayActive, setVideoOverlayActive] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Refs for stale-closure-safe access in setTimeout chains
  const modelReadyRef = useRef(false);
  const pendingFlyToCorner = useRef(false);

  const positions = useLogoPositions();
  const { unlock: unlockAudio, prefetchTts } = useNarration();

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

  const { scrollYProgress } = useScroll();
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (phase === "idle") {
      setShowButton(v > 0.75);
      // User is approaching the CTA — decode GLB if first paint was too early.
      if (v > 0.45) {
        void import("@/lib/logoModelPreload")
          .then((m) => m.preloadClubLogoModel())
          .catch(() => {});
      }
    }
  });

  const flyToCorner = useCallback(() => {
    setPhase("logo-fly-corner");
    // Wait for fly animation (1.4s) to finish, then go straight to the welcome video.
    // (The pre-video "dhak-dhak" stats intro has been removed — stats now live only
    // on the post-video ReadyToPlayGate to avoid repetition.)
    setTimeout(() => setPhase("welcome-video"), 1500);
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

    // After ripple has mostly filled, show logo at center (ripple animation is 4.5s).
    // 2.4s keeps the beat without waiting so long that the GLB feels "stuck" if preload lagged.
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
            // Model still loading, will trigger via useEffect when ready.
            pendingFlyToCorner.current = true;
            // Safety net: if the GLB genuinely fails to load (network blip,
            // decoder error, etc.) and Logo3D's own fallback doesn't trip,
            // don't leave the user stuck on the loading screen. After 8s at
            // logo-center we flip the flag ourselves so the flow advances.
            setTimeout(() => {
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
      // Start ElevenLabs fetch on the same click as unlock so audio is often
      // cached before Instructions mounts (avoids play() after a long gap).
      const instructionsText = buildInstructionsNarration(data.name);
      void prefetchTts("instructions-intro", instructionsText);
      void unlockAudio().then(() => setPhase("instructions"));
    },
    [unlockAudio, prefetchTts],
  );

  const handleBeginGame = useCallback(() => {
    setPhase("playing");
  }, []);

  const handleLogoReady = useCallback(() => {
    setLogoModelReady(true);
  }, []);

  const showWelcomeVideo = phase === "welcome-video";
  const showPostVideoGate = phase === "post-video-gate";

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
  const showOverlay = phase === "details" || phase === "instructions" || phase === "playing";
  const showLogo =
    phase === "ripple" ||
    phase === "logo-enter" ||
    phase === "logo-center" ||
    phase === "logo-fly-corner" ||
    showWelcomeVideo ||
    showPostVideoGate ||
    showOverlay;

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
            transition={{ duration: 0.4, ease: EASE_OUT }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Enter experience"
            className="group fixed bottom-16 right-7 z-30 cursor-pointer sm:bottom-18 sm:right-9 md:bottom-20 md:right-11"
          >
            {/* Ambient brass halo — always on so the CTA reads from across the room */}
            <div
              className="pointer-events-none absolute -inset-10 rounded-full bg-amber-400/15 blur-3xl motion-safe:animate-[glow-pulse_2.8s_ease-in-out_infinite] md:-inset-14"
              aria-hidden
            />
            {/* Expanding ring — always visible (subtle); stronger on hover */}
            <div className="absolute -inset-5 rounded-full opacity-[0.45] transition-opacity duration-500 group-hover:opacity-90 md:-inset-6">
              <div
                className="h-full w-full rounded-full border border-brass/35"
                style={{ animation: "pulse-ring 2.2s ease-out infinite" }}
              />
            </div>
            <div className="absolute -inset-6 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:-inset-8">
              <div
                className="h-full w-full rounded-full border border-brass/50"
                style={{ animation: "pulse-ring 2.2s ease-out infinite" }}
              />
            </div>
            <div className="absolute -inset-12 rounded-full bg-brass/14 blur-[56px] transition-all duration-500 group-hover:bg-brass/24 md:-inset-16" />
            <div
              className="enter-cta-metallic-ring relative size-[min(252px,54vw)] sm:size-[min(270px,44vw)] md:size-[280px]"
            >
              <div className="relative z-0 size-full overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35),inset_0_2px_12px_rgba(0,0,0,0.25)]">
                <img
                  src={ENTER_BUTTON_IMAGE}
                  alt=""
                  className="size-full scale-110 object-cover object-[50%_40%]"
                />
                <div className="absolute inset-0 z-[3] flex items-center justify-center bg-black/30 transition-colors duration-300 group-hover:bg-black/12">
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="ml-1 text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.75)] md:h-12 md:w-12"
                  aria-hidden
                >
                  <path
                    d="M8 5.14v13.72a1 1 0 001.5.86l11.04-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z"
                    fill="currentColor"
                  />
                </svg>
                </div>
              </div>
            </div>
            <span className="absolute -bottom-11 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.52em] text-brass-bright drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] md:-bottom-12 md:text-xs md:tracking-[0.55em]">
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
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              onEnded={handleVideoEnd}
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
            {(phase === "details" || phase === "instructions") && (
              <>
                {/* Blurred backdrop image — scaled up slightly so the blur edges
                    don't reveal the black void behind it. */}
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
                {/* Dark veil — keeps foreground text readable on top of the blur. */}
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

            {phase !== "details" && phase !== "instructions" && (
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
                  playerName={player?.name || "Player"}
                  onVideoOverlayChange={setVideoOverlayActive}
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
