"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useNarration } from "@/components/NarrationProvider";

/**
 * One-tap audio primer for the live join pages (/play, /watch).
 *
 * Participants usually arrive via a SHARED LINK opened fresh — there's been
 * no user gesture in the document, so the browser blocks autoplay. Without
 * this, the per-question host voice-over (which fires during the server's
 * "narrating" sub-phase) is silently blocked, and sound only "wakes up" when
 * the player first taps the screen (around the timer). This gate guarantees a
 * gesture up front so the host VO + theme play from the very first question.
 *
 * `unlock()` also runs the secondary audio unlocks (GameShowAudio bed), so a
 * single tap primes everything. Auto-skips when audio is already unlocked
 * (e.g. players who came through the in-app registration flow).
 */
export default function LiveAudioGate({ onReady }: { onReady: () => void }) {
  const { unlock } = useNarration();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unlock();
    } catch {
      /* even if unlock rejects, proceed — first in-page tap already counts */
    } finally {
      onReady();
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-black px-6 text-center">
      <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">The 1% Club</p>
      <h1 className="mt-3 max-w-md text-2xl font-semibold text-foreground md:text-3xl">
        Tap to join with sound
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-foreground/60">
        One tap turns on the host voice and music. Your browser needs this each time you open the link
        before sound can play.
      </p>
      <motion.button
        type="button"
        disabled={busy}
        onClick={go}
        whileHover={{ scale: busy ? 1 : 1.03 }}
        whileTap={{ scale: busy ? 1 : 0.97 }}
        className="game-show-btn relative z-0 mt-9 cursor-pointer rounded-xl px-12 py-4 text-center text-[13px] font-semibold uppercase tracking-[0.22em] disabled:cursor-wait disabled:opacity-70"
      >
        <span className="relative z-10">{busy ? "Starting…" : "Enter with sound"}</span>
      </motion.button>
    </main>
  );
}
