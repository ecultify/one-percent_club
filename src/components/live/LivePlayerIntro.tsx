"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LiveAudioGate from "@/components/live/LiveAudioGate";

/**
 * Pre-game intro shown the moment a player opens the shared /play link,
 * BEFORE they ever reach the lobby:
 *
 *   1. "teaser"       — the teaser video plays (muted autoplay so it starts
 *                       without a gesture; an unmute tap is offered).
 *   2. "instructions" — a few rule cards explaining how the quiz works.
 *   3. "gate"         — defers to LiveAudioGate, which collects the player's
 *                       name, primes audio (the required user gesture) and
 *                       then hands the trimmed name back via onReady.
 *
 * onReady fires only at the end of step 3, exactly like the bare gate did
 * before, so the parent page's join logic is unchanged.
 */
interface LivePlayerIntroProps {
  onReady: (name: string) => void;
  initialName?: string;
}

const TEASER_SRC = "/teaser-video.mp4";
const TEASER_POSTER = "/teaser-video.mp4.poster.jpg";

const INSTRUCTIONS = [
  {
    kicker: "How it works",
    title: "One question at a time",
    body: "The host runs the room. Each round a single question appears on your screen at the same moment for everyone.",
  },
  {
    kicker: "Beat the clock",
    title: "Lock your answer before time runs out",
    body: "A timer counts down on every question. Type or tap your answer and submit before it hits zero — once you submit, it's locked in.",
  },
  {
    kicker: "Survive",
    title: "A wrong answer puts you out",
    body: "Get it wrong or run out of time and you're eliminated, then watch the rest play out. Stay sharp and you could be the 1%.",
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

export default function LivePlayerIntro({ onReady, initialName = "" }: LivePlayerIntroProps) {
  const [stage, setStage] = useState<"teaser" | "instructions" | "gate">("teaser");
  const [muted, setMuted] = useState(true);
  const [step, setStep] = useState(0);

  if (stage === "gate") {
    return <LiveAudioGate collectName requireName initialName={initialName} onReady={onReady} />;
  }

  if (stage === "teaser") {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-black">
        <video
          src={TEASER_SRC}
          poster={TEASER_POSTER}
          autoPlay
          muted={muted}
          playsInline
          preload="auto"
          onEnded={() => setStage("instructions")}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(3,2,8,0.25)" }} aria-hidden />

        {/* Unmute prompt — the teaser autoplays muted (no gesture yet); one tap
            turns the sound on without leaving the screen. */}
        <AnimatePresence>
          {muted && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => setMuted(false)}
              className="absolute left-1/2 top-6 z-10 -translate-x-1/2 cursor-pointer rounded-full border border-brass/40 bg-black/70 px-5 py-2 text-[11px] font-mono uppercase tracking-[0.28em] text-brass-bright backdrop-blur"
            >
              🔊 Tap for sound
            </motion.button>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setStage("instructions")}
          className="absolute bottom-7 right-6 z-10 cursor-pointer rounded-full border border-white/25 bg-black/55 px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/85 backdrop-blur transition-colors hover:border-white/45 hover:text-white"
        >
          Skip intro →
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
          onClick={() => (isLast ? setStage("gate") : setStep((s) => s + 1))}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="game-show-btn relative z-0 mt-8 cursor-pointer rounded-xl px-12 py-4 text-center text-[13px] font-semibold uppercase tracking-[0.22em]"
        >
          <span className="relative z-10">{isLast ? "I'm ready →" : "Next"}</span>
        </motion.button>

        {!isLast && (
          <button
            type="button"
            onClick={() => setStage("gate")}
            className="mt-4 cursor-pointer text-[11px] font-mono uppercase tracking-[0.25em] text-white/45 transition-colors hover:text-white/70"
          >
            Skip
          </button>
        )}
      </div>
    </main>
  );
}
