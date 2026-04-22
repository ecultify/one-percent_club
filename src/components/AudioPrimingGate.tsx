"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNarration } from "./NarrationProvider";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

/**
 * Full-screen step before the hero: one explicit tap unlocks narration + theme.
 * Shown on every load (including reload) so the browser gets a fresh user activation
 * and sound can play reliably.
 */
export default function AudioPrimingGate({ children }: { children: React.ReactNode }) {
  const { unlock } = useNarration();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unlock();
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {children}
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            key="audio-priming"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audio-priming-title"
            aria-describedby="audio-priming-desc"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#030208] px-6"
            style={{
              background:
                "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(24,18,8,0.97) 0%, #030208 55%, #010004 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              }}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
              className="relative z-[1] flex max-w-md flex-col items-center text-center"
            >
              <p
                id="audio-priming-title"
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.42em] text-[#c9a94a] md:text-[11px]"
              >
                Sound check
              </p>
              <div
                className="mx-auto my-6 h-px w-16 bg-gradient-to-r from-transparent via-[#e4cf6a]/70 to-transparent"
                aria-hidden
              />
              <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#fff4dc] md:text-3xl">
                Enable audio for the full experience
              </h1>
              <p
                id="audio-priming-desc"
                className="mt-4 text-sm leading-relaxed text-[#ebe4d8]/75 md:text-[15px]"
              >
                One tap unlocks music and the host voice. Your browser needs this each time you open or
                refresh the page before sound can play.
              </p>
              <motion.button
                type="button"
                disabled={busy}
                onClick={handleContinue}
                whileHover={{ scale: busy ? 1 : 1.02 }}
                whileTap={{ scale: busy ? 1 : 0.98 }}
                className="game-show-btn relative z-0 mt-10 cursor-pointer rounded-xl px-14 py-[16px] text-center text-[13px] font-semibold uppercase tracking-[0.22em] disabled:cursor-wait disabled:opacity-70 md:px-16 md:py-[18px] md:text-[14px]"
              >
                <span className="relative z-10">{busy ? "Starting…" : "Continue with sound"}</span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
