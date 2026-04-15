"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNarration } from "./NarrationProvider";
import MuteButton from "./MuteButton";
import HostSilhouette from "./HostSilhouette";
import PathToOnePercent from "./PathToOnePercent";
import { useParallax } from "./useParallax";

interface InstructionsProps {
  playerName: string;
  onStart: () => void;
}

/** Take only the first word of a full name (for natural-sounding TTS). */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "friend";
}

function buildInstructionsNarration(name: string) {
  const first = firstNameOf(name);
  return (
    `${first}, ab suniye game kaise khelna hai. ` +
    `Yeh khel aath sawaalon ka hai. Har sawaal ke saath ek percentage diya hoga. ` +
    `Yeh percentage batata hai ki India mein kitne log yeh sawaal sahi kar sakte hain. ` +
    `Pehla sawaal nabbe percent ka, kaafi aasaan. ` +
    `Aur aakhri sawaal sirf ek percent ka. Sirf ek percent log usse crack kar paate hain. ` +
    `Har sawaal ka ek time limit hoga. Jaldi sochiye, dil se jawab dijiye. ` +
    `Logic, reasoning, aur instinct. Bas yahi hai aapka hathiyaar. ` +
    `Toh kya aap taiyaar hain? Chaliye, shuroo karte hain.`
  );
}

const rules = [
  {
    percent: "90%",
    text: "You begin where most people still get it right — a gentle warm-up.",
    accent: "text-emerald-400/90",
    bar: "bg-emerald-400/80",
  },
  {
    percent: "50%",
    text: "Each round thins the crowd. The label is the share that can answer correctly.",
    accent: "text-brass-bright",
    bar: "bg-brass-bright/90",
  },
  {
    percent: "1%",
    text: "The last question is cruelly selective — that is the whole point.",
    accent: "text-red-400/85",
    bar: "bg-red-400/75",
  },
];

export default function Instructions({ playerName, onStart }: InstructionsProps) {
  const { narrate, stop } = useNarration();

  useEffect(() => {
    narrate("instructions-intro", buildInstructionsNarration(playerName));
    return () => stop();
  }, [narrate, stop, playerName]);

  const handleSkip = () => {
    stop();
    onStart();
  };

  const parallax = useParallax();

  return (
    <div className="w-full max-w-3xl md:max-w-4xl mx-4 relative max-h-[90vh] flex flex-col">
      <MuteButton />

      {/* Ambient host silhouette on left side for Instructions */}
      <HostSilhouette side="left" opacity={0.16} />

      {/* Parallax halo */}
      <div
        className="absolute -inset-20 bg-brass/[0.05] rounded-[3rem] blur-[90px] pointer-events-none"
        style={{
          transform: `translate(${parallax.x * 10}px, ${parallax.y * 8}px)`,
          transition: "transform 0.05s linear",
        }}
      />
      <div className="absolute -inset-12 bg-brass/[0.04] rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl border-2 border-brass/25 bg-gradient-to-b from-surface-light/90 to-surface/95 shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75),0_0_60px_-10px_rgba(196,160,53,0.12)] overflow-y-auto overflow-x-hidden backdrop-blur-sm">
        <div className="absolute inset-0 opacity-[0.018] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-brass-bright/70 to-transparent shadow-[0_0_20px_rgba(228,207,106,0.35)]" />

        <div className="relative p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="mb-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-brass-dim mb-4">
              Welcome, <span className="text-foreground/80">{firstNameOf(playerName)}</span>
            </p>
            <h2 className="font-display text-3xl md:text-[2rem] font-semibold tracking-[-0.02em] text-foreground leading-tight">
              How it works
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-5">
            {rules.map((rule, i) => (
              <motion.div
                key={rule.percent}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.12 + i * 0.08,
                  duration: 0.5,
                  ease: [0.23, 1, 0.32, 1],
                }}
                className="relative flex flex-col gap-3 p-4 md:p-5 rounded-xl border-2 border-white/[0.12] bg-black/30 shadow-inner overflow-hidden"
              >
                {/* Thin accent bar across the top */}
                <div className={`absolute top-0 left-0 right-0 h-[3px] ${rule.bar}`} />
                <span className={`font-display text-3xl md:text-4xl font-bold tabular-nums leading-none ${rule.accent}`}>
                  {rule.percent}
                </span>
                <p className="text-sm text-foreground/75 leading-relaxed">{rule.text}</p>
              </motion.div>
            ))}
          </div>

          {/* ── Path to 1% visualization ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
            className="mb-5 rounded-xl border border-white/[0.08] bg-black/25 p-4"
          >
            <PathToOnePercent />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="text-center text-[11px] text-muted leading-relaxed mb-5"
          >
            Answer within the clock. Hesitation costs the same as a wrong guess.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-3"
          >
            <motion.button
              onClick={onStart}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="game-show-btn relative z-0 w-full cursor-pointer rounded-xl bg-brass py-4 text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-[#14110a] transition-colors hover:bg-brass-bright"
            >
              <span className="relative z-10">Begin the challenge</span>
            </motion.button>
            <button
              onClick={handleSkip}
              className="w-full cursor-pointer rounded-xl bg-white/[0.03] border border-white/[0.08] py-3 text-center text-[11px] font-mono uppercase tracking-[0.28em] text-muted hover:text-foreground/80 hover:border-white/15 transition-colors"
            >
              Skip narration & begin
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
