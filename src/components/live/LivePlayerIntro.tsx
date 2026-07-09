"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import LiveAudioGate from "@/components/live/LiveAudioGate";

/**
 * Pre-game intro shown the moment a player opens the shared /play link,
 * BEFORE they ever reach the lobby:
 *
 *   0. "loading" — a brief branded loading screen (logo + circular progress)
 *                  shown the instant the link opens, while the gate art / audio
 *                  warm up.
 *   1. "sound"   — a one-tap "enable sound & enter" gate over a STATIC frame of
 *                  the host (Anil Kapoor) + the "India Ke Top 1%" key-art. This
 *                  is the required user gesture: it primes audio up front so the
 *                  host VO can play WITH sound.
 *   2. "name"    — collects the player's name and hands the trimmed name back
 *                  via onReady, which drops them into the lobby.
 *
 * The teaser video and the multi-page rules/instructions screen were removed
 * (client request, July 2026): the emcee briefs participants live, and the intro
 * is now just the static key-art gate — no video plays before the game.
 *
 * onReady fires only at the end of the name step, so the parent page's join
 * logic (name + audio ready → lobby) is unchanged.
 */
interface LivePlayerIntroProps {
  onReady: (name: string) => void;
  initialName?: string;
}

const LOADING_LOGO_SRC = "/play-loading-logo.webp";
/** Static host key-art shown behind the sound gate (Anil Kapoor + 1% logo).
 *  Preloaded during the loading screen so the sound step paints instantly. */
const GATE_HERO_MOBILE = "/play-gate-mobile.webp";
const GATE_HERO_DESKTOP = "/play-gate-desktop.webp";

export default function LivePlayerIntro({ onReady, initialName = "" }: LivePlayerIntroProps) {
  const [stage, setStage] = useState<"loading" | "sound" | "name">("loading");

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

  // Step 1 — enable sound & enter, over the static Anil Kapoor key-art. The one
  // tap primes audio for the whole session (host VO + theme), then advances
  // straight to the name step (no teaser, no rules screen).
  if (stage === "sound") {
    return (
      // Distinct `key` from the name gate below: both stages render a
      // LiveAudioGate as this component's root, so without unique keys React
      // reuses the SAME instance across sound → name and leaks its internal
      // state — the `busy` flag set by tapping "Enable sound & enter" carries
      // over and strands the name gate's button on "Starting…" (go() bails
      // while busy). Separate keys force a fresh, unbusy name gate.
      <LiveAudioGate
        key="sound-gate"
        heroSrc={{ mobile: GATE_HERO_MOBILE, desktop: GATE_HERO_DESKTOP }}
        subtitle="Turn on the host voice and music to join the game."
        cta="Enable sound & enter"
        onReady={() => setStage("name")}
      />
    );
  }

  // Step 2 — collect the player's name (audio already unlocked).
  return (
    <LiveAudioGate
      key="name-gate"
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
