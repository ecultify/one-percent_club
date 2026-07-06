"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LiveAudioGate from "@/components/live/LiveAudioGate";
import { useIsPortraitMobile } from "@/components/RotateForVideo";

/**
 * Pre-game intro shown the moment a player opens the shared /play link,
 * BEFORE they ever reach the lobby:
 *
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
  const [stage, setStage] = useState<"sound" | "teaser" | "instructions" | "name">("sound");
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
