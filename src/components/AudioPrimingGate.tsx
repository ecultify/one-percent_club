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
            // `justify-end` + bottom padding pushes the copy + CTA into the
            // lower third of the screen, leaving the upper ~60% of the
            // background video (the "1% CLUB" hero letters) fully visible.
            className="fixed inset-0 z-[200] flex flex-col items-center justify-end overflow-hidden bg-[#030208] px-6 pb-[8vh] md:pb-[10vh]"
          >
            {/* Home page video as the backdrop — sharp, no blur. Muted so it
                can autoplay before the user grants the audio activation gesture. */}
            <video
              src="/homepagevideo.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
            {/* Two-stage scrim:
                1) Light flat tint to take the overall brightness off the video.
                2) A CENTER-darkened radial — opposite of a typical vignette —
                   so the text in the middle of the screen has the highest
                   contrast against the footage, while the corners stay
                   relatively cleaner so the video still reads as the hero. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "rgba(3,2,8,0.28)",
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                // Vignette focal point dropped from 50% to 78% vertically so
                // the darkest patch sits behind the text + button block in
                // the lower third. Upper section of the background video
                // ("1% CLUB" letters) is now untouched and reads cleanly.
                background:
                  "radial-gradient(ellipse 60% 38% at 50% 78%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.2) 78%, transparent 100%)",
              }}
              aria-hidden
            />
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
              <h1
                id="audio-priming-title"
                className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#fff4dc] md:text-3xl"
                style={{
                  textShadow:
                    "0 0 2px rgba(0,0,0,1), 0 2px 14px rgba(0,0,0,0.92), 0 0 36px rgba(0,0,0,0.7), 0 1px 0 rgba(0,0,0,0.9)",
                }}
              >
                Enable audio for the full experience
              </h1>
              <p
                id="audio-priming-desc"
                className="mt-4 text-sm leading-relaxed text-[#f4ecdc] md:text-[15px]"
                style={{
                  textShadow:
                    "0 0 2px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.9), 0 0 22px rgba(0,0,0,0.55)",
                }}
              >
                One tap unlocks music and the host voice. Your browser needs this each time you open or
                refresh the page before sound can play.
              </p>
              {/* Wrapper holds a soft pulsing halo BEHIND the button so the
                  CTA reads as the live element on the page without any of
                  the button's own paint changing. The halo is purely
                  decorative — pointer-events-none — and animates a gentle
                  scale + opacity loop so it breathes rather than blinks. */}
              <div className="relative mt-10 inline-flex items-center justify-center">
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-[1] rounded-2xl"
                  style={{
                    background:
                      "radial-gradient(ellipse 70% 100% at 50% 50%, rgba(245,210,108,0.55) 0%, rgba(228,196,90,0.28) 35%, transparent 75%)",
                    filter: "blur(18px)",
                  }}
                  animate={{
                    opacity: [0.55, 0.95, 0.55],
                    scale: [1, 1.08, 1],
                  }}
                  transition={{
                    duration: 2.4,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                />
                <motion.button
                  type="button"
                  disabled={busy}
                  onClick={handleContinue}
                  whileHover={{ scale: busy ? 1 : 1.02 }}
                  whileTap={{ scale: busy ? 1 : 0.98 }}
                  className="game-show-btn relative z-0 cursor-pointer rounded-xl px-14 py-[16px] text-center text-[13px] font-semibold uppercase tracking-[0.22em] disabled:cursor-wait disabled:opacity-70 md:px-16 md:py-[18px] md:text-[14px]"
                >
                  <span className="relative z-10">{busy ? "Starting…" : "Continue with sound"}</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
