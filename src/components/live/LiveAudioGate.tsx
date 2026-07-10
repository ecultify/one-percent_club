"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useNarration } from "@/components/NarrationProvider";

/**
 * One-tap audio primer for the live join pages (/play, /watch), optionally
 * collecting the player's name in the same step.
 *
 * Participants usually arrive via a SHARED LINK opened fresh — there's been
 * no user gesture in the document, so the browser blocks autoplay. Without
 * this, the per-question host voice-over is silently blocked. This gate
 * guarantees a gesture up front so the host VO + theme play from the first
 * question. `unlock()` also runs the secondary audio unlocks (GameShowAudio
 * bed), so a single tap primes everything.
 *
 * Backed by the same home-video backdrop as the main app's start screen.
 */
interface LiveAudioGateProps {
  /** Called once the user taps through; passes the entered name (trimmed). */
  onReady: (name: string) => void;
  /** Show a name field (used on /play). */
  collectName?: boolean;
  /** Require a non-empty name before enabling the button. */
  requireName?: boolean;
  /** Prefill the name field (e.g. from the ?name= query). */
  initialName?: string;
  /** Override the heading (e.g. a name-only step where audio is already on). */
  heading?: string;
  /** Override the sub-heading paragraph. */
  subtitle?: string;
  /** Override the call-to-action label (idle state). */
  cta?: string;
  /** Full-bleed hero key-art background (portrait for phones, landscape for
   *  desktop). When set, the muted home-video backdrop is replaced by these
   *  static images and the CTA is anchored to the bottom so it clears the
   *  artwork/branding.
   *
   *  `mobile` is optional: omit it to keep the home-video backdrop on phones
   *  (and the centred heading + CTA that go with it) while desktop still gets
   *  its key-art. */
  heroSrc?: { mobile?: string; desktop: string };
}

/** The muted home-video backdrop shared by the lobby, the name gate and — when
 *  `heroSrc.mobile` is omitted — the sound gate on phones. Muted so it
 *  autoplays before the user grants the audio gesture. */
function HomeVideoBackdrop({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      <video
        src="/homepagevideo.mp4"
        poster="/homepagevideo.mp4.poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0" style={{ background: "rgba(3,2,8,0.45)" }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 42% at 50% 60%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.2) 78%, transparent 100%)",
        }}
      />
    </div>
  );
}

export default function LiveAudioGate({
  onReady,
  collectName = false,
  requireName = false,
  initialName = "",
  heading,
  subtitle,
  cta,
  heroSrc,
}: LiveAudioGateProps) {
  const { unlock } = useNarration();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initialName);

  const trimmed = name.trim();
  const blocked = requireName && !trimmed;

  const go = () => {
    if (busy || blocked) return;
    setBusy(true);
    // Prime audio in the BACKGROUND — the tap itself is the audio gesture, so
    // we never need to await it. On some browsers audio.play() returns a
    // promise that never settles; awaiting it would strand the button on
    // "Starting…" forever. Fire-and-forget, then advance immediately.
    try {
      void Promise.resolve(unlock()).catch(() => {});
    } catch {
      /* unlock threw synchronously — ignore, the join proceeds regardless */
    }
    onReady(trimmed);
  };

  const hero = !!heroSrc;
  const heroMobile = heroSrc?.mobile;
  /** Hero art on desktop, home-video backdrop on phones. The phone layout then
   *  matches the name gate that immediately follows, so clearing the sound gate
   *  no longer swaps the background out from under the player. */
  const videoOnMobile = hero && !heroMobile;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      {hero ? (
        <>
          {/* Full-bleed key-art: portrait on phones, landscape on desktop. */}
          {heroMobile ? (
            <img
              src={heroMobile}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover md:hidden"
            />
          ) : (
            <HomeVideoBackdrop className="md:hidden" />
          )}
          <img
            src={heroSrc.desktop}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover md:block"
          />
          {/* Bottom scrim so the CTA stays legible over the artwork. Only where
              the artwork actually renders — the video backdrop brings its own. */}
          <div
            className={`pointer-events-none absolute inset-0 ${videoOnMobile ? "hidden md:block" : ""}`}
            style={{
              background:
                "linear-gradient(to bottom, transparent 42%, rgba(3,2,8,0.55) 76%, rgba(3,2,8,0.94) 100%)",
            }}
            aria-hidden
          />
        </>
      ) : (
        <HomeVideoBackdrop />
      )}

      <div
        className={`relative z-[1] flex min-h-screen flex-col items-center px-6 text-center ${
          !hero
            ? "justify-center"
            : videoOnMobile
              ? "justify-center md:justify-end md:pb-16"
              : "justify-end pb-14 md:pb-16"
        }`}
      >
        {/* The hero art already carries the "1% Club" branding, so skip the
            kicker/heading wherever it renders and let the CTA speak for itself.
            Over the video backdrop there is no branding, so the heading returns. */}
        {(!hero || videoOnMobile) && (
          <div className={videoOnMobile ? "contents md:hidden" : "contents"}>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/80">The 1% Club</p>
            <h1
              className="mt-3 max-w-md text-2xl font-semibold text-[#fff4dc] md:text-3xl"
              style={{ textShadow: "0 2px 14px rgba(0,0,0,0.92), 0 0 36px rgba(0,0,0,0.7)" }}
            >
              {heading ?? (collectName ? "Join with your name and sound" : "Tap to join with sound")}
            </h1>
          </div>
        )}
        <p
          className={`max-w-sm text-sm leading-relaxed text-[#f4ecdc] ${
            !hero ? "mt-3" : videoOnMobile ? "mt-3 md:mt-0" : ""
          }`}
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}
        >
          {subtitle ??
            "One tap turns on the host voice and music. Your browser needs this each time you open the link before sound can play."}
        </p>

        {collectName && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void go();
            }}
            placeholder="Your name"
            maxLength={32}
            autoFocus
            className="mt-7 w-full max-w-xs rounded-xl border border-brass/30 bg-black/55 px-4 py-3.5 text-center text-[15px] text-foreground placeholder:text-foreground/40 outline-none backdrop-blur transition-colors focus:border-brass/60 focus:bg-black/65"
          />
        )}

        <motion.button
          type="button"
          disabled={busy || blocked}
          onClick={go}
          whileHover={{ scale: busy || blocked ? 1 : 1.03 }}
          whileTap={{ scale: busy || blocked ? 1 : 0.97 }}
          className="game-show-btn relative z-0 mt-6 cursor-pointer rounded-xl px-12 py-4 text-center text-[13px] font-semibold uppercase tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="relative z-10">{busy ? "Starting…" : cta ?? "Enter with sound"}</span>
        </motion.button>
      </div>
    </main>
  );
}
