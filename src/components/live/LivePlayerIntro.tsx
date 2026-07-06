"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LiveAudioGate from "@/components/live/LiveAudioGate";
import { useIsPortraitMobile } from "@/components/RotateForVideo";

/**
 * Pre-game intro shown the moment a player opens the shared /play link,
 * BEFORE they ever reach the lobby:
 *
 *   0. "loading"      — a brief branded loading screen (logo + circular
 *                       progress) shown the instant the link opens, while the
 *                       gate art / audio warm up.
 *   1. "sound"        — a one-tap "enable sound & enter" gate. This is the
 *                       required user gesture: it primes audio up front so the
 *                       teaser (and later the host VO) can play WITH sound.
 *   2. "teaser"       — the teaser video plays with sound (audio already
 *                       unlocked). No unmute prompt; a "Skip video" button sits
 *                       where the sound prompt used to be.
 *   3. "instructions" — a few rule cards explaining how the quiz works.
 *   4. "name"         — collects the player's name and hands the trimmed name
 *                       back via onReady, which drops them into the lobby.
 *
 * onReady fires only at the end of the name step, so the parent page's join
 * logic (name + audio ready → lobby) is unchanged.
 */
interface LivePlayerIntroProps {
  onReady: (name: string) => void;
  initialName?: string;
  /** Host control: when false, the multi-page rules screen is skipped (teaser
   *  goes straight to the name/audio gate). Defaults to true. */
  showInstructions?: boolean;
}

const TEASER_SRC = "/teaser-video.mp4";
const TEASER_POSTER = "/teaser-video.mp4.poster.jpg";
const LOADING_LOGO_SRC = "/play-loading-logo.webp";
/** Gate art preloaded during the loading screen so the sound step paints
 *  instantly. Keep in sync with the sound stage's heroSrc below. */
const GATE_HERO_MOBILE = "/play-gate-mobile.webp";
const GATE_HERO_DESKTOP = "/play-gate-desktop.webp";

const INSTRUCTIONS = [
  {
    kicker: "How it works",
    title: "One question at a time",
    body: "The host creates and manages the lobby. In each round, a single question appears on everyone's screen at the same time.",
  },
  {
    kicker: "Beat the clock",
    title: "Lock your answer before the time runs out",
    body: "A timer counts down on every question. Type or tap your answer and submit before the timer hits zero. Once you submit, it's locked in.",
  },
  {
    kicker: "Survive",
    title: "A wrong answer eliminates you from the game",
    body: "Get it wrong or run out of time and you're eliminated, then watch the rest play out. Stay sharp and you could be amongst the Top 1%.",
  },
];

function IntroBackdrop() {
  return (
    <>
      <video
        src="/homepagevideo.mp4"
        poster="/homepagevideo.mp4.poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(3,2,8,0.62)" }} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 42% at 50% 55%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.2) 78%, transparent 100%)",
        }}
        aria-hidden
      />
    </>
  );
}

export default function LivePlayerIntro({ onReady, initialName = "", showInstructions = true }: LivePlayerIntroProps) {
  const [stage, setStage] = useState<"loading" | "sound" | "teaser" | "instructions" | "name">("loading");
  const [step, setStep] = useState(0);
  const teaserRef = useRef<HTMLVideoElement | null>(null);
  /** Where the teaser hands off — to the rules screen, or straight to the name
   *  step when the host has hidden the instructions. */
  const afterTeaser: "instructions" | "name" = showInstructions ? "instructions" : "name";

  // Teaser plays upright in its natural orientation — identical to the
  // homepage journey (GameFlow). No 90° rotation and no "tilt your phone"
  // notice. On a portrait phone it's letterboxed (object-contain, see below)
  // so the FULL frame is visible with black margins; it's never zoomed or
  // cropped.
  const portraitMobile = useIsPortraitMobile();

  // Audio was already unlocked in the "sound" gate, so the teaser plays with
  // sound. Autoplay-with-audio is permitted because that tap was a genuine
  // user gesture in this document, but nudge play() on mount in case the
  // browser didn't kick it off on its own.
  useEffect(() => {
    if (stage !== "teaser") return;
    teaserRef.current?.play().catch(() => {});
  }, [stage]);

  // Warm the gate key-art (and the logo) while the loading screen is up so the
  // sound step paints without a flash.
  useEffect(() => {
    if (stage !== "loading") return;
    for (const src of [GATE_HERO_MOBILE, GATE_HERO_DESKTOP]) {
      const img = new Image();
      img.src = src;
    }
  }, [stage]);

  // Step 0 — branded loading screen. A circular progress ring fills over a
  // short, fixed beat; when it completes we advance to the sound gate. (The
  // gate art is preloaded above, so this doubles as a real warm-up window.)
  if (stage === "loading") {
    return (
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-black px-6">
        <motion.img
          src={LOADING_LOGO_SRC}
          alt="India Ke Top 1%"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-[min(64vw,340px)] object-contain"
          style={{ filter: "drop-shadow(0 0 46px rgba(228,174,68,0.28))" }}
        />
        <div className="relative mt-9 h-12 w-12 md:h-14 md:w-14">
          <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(249,232,154,0.16)" strokeWidth="3.5" />
            <motion.circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="#f9e89a"
              strokeWidth="3.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.2, ease: "easeInOut" }}
              onAnimationComplete={() => setStage("sound")}
              style={{ filter: "drop-shadow(0 0 6px rgba(249,232,154,0.6))" }}
            />
          </svg>
        </div>
        <p className="mt-5 text-[11px] font-mono uppercase tracking-[0.4em] text-brass/70">Loading…</p>
      </main>
    );
  }

  // Step 1 — enable sound & enter. The one tap primes audio for the whole
  // session (teaser + host VO), then advances to the teaser.
  if (stage === "sound") {
    return (
      <LiveAudioGate
        heroSrc={{ mobile: "/play-gate-mobile.webp", desktop: "/play-gate-desktop.webp" }}
        subtitle="Turn on the host voice and music, then the intro plays."
        cta="Enable sound & enter"
        onReady={() => setStage("teaser")}
      />
    );
  }

  if (stage === "name") {
    return (
      <LiveAudioGate
        collectName
        requireName
        initialName={initialName}
        heading="Almost in — what's your name?"
        subtitle="This is how you'll show up on the host's screen and the leaderboard."
        cta="Enter the lobby"
        onReady={onReady}
      />
    );
  }

  if (stage === "teaser") {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-black">
        <video
          ref={teaserRef}
          src={TEASER_SRC}
          poster={TEASER_POSTER}
          autoPlay
          playsInline
          preload="auto"
          onEnded={() => setStage(afterTeaser)}
          // Portrait phone: object-contain letterboxes the upright video so
          // the full frame shows; desktop/landscape fills with object-cover.
          className={
            portraitMobile
              ? "absolute inset-0 h-full w-full object-contain"
              : "absolute inset-0 h-full w-full object-cover"
          }
        />
        <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(3,2,8,0.25)" }} aria-hidden />

        {/* Sound is already on (primed in the "sound" gate), so there's no
            unmute prompt. The Skip button takes that same top-centre spot. */}
        <button
          type="button"
          onClick={() => setStage(afterTeaser)}
          className="absolute left-1/2 top-6 z-10 -translate-x-1/2 cursor-pointer rounded-full border border-white/25 bg-black/60 px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/85 backdrop-blur transition-colors hover:border-white/45 hover:text-white"
        >
          Skip video →
        </button>
      </main>
    );
  }

  // stage === "instructions"
  const card = INSTRUCTIONS[step];
  const isLast = step === INSTRUCTIONS.length - 1;
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      <IntroBackdrop />
      <div className="relative z-[1] flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/80">The 1% Club</p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 max-w-md"
          >
            <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-brass-bright/90">{card.kicker}</p>
            <h1
              className="mt-3 text-2xl font-semibold text-[#fff4dc] md:text-3xl"
              style={{ textShadow: "0 2px 14px rgba(0,0,0,0.92), 0 0 36px rgba(0,0,0,0.7)" }}
            >
              {card.title}
            </h1>
            <p
              className="mt-4 text-sm leading-relaxed text-[#f4ecdc]"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}
            >
              {card.body}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="mt-8 flex items-center gap-2">
          {INSTRUCTIONS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 22 : 7,
                background: i === step ? "#f9e89a" : "rgba(249,232,154,0.3)",
              }}
            />
          ))}
        </div>

        <motion.button
          type="button"
          onClick={() => (isLast ? setStage("name") : setStep((s) => s + 1))}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="game-show-btn relative z-0 mt-8 cursor-pointer rounded-xl px-12 py-4 text-center text-[13px] font-semibold uppercase tracking-[0.22em]"
        >
          <span className="relative z-10">{isLast ? "I'm ready →" : "Next"}</span>
        </motion.button>

        {!isLast && (
          <button
            type="button"
            onClick={() => setStage("name")}
            className="mt-4 cursor-pointer text-[11px] font-mono uppercase tracking-[0.25em] text-white/45 transition-colors hover:text-white/70"
          >
            Skip
          </button>
        )}
      </div>
    </main>
  );
}
