"use client";

import { motion } from "framer-motion";
import { METALLIC_RIM_GRADIENT, PANEL_INNER_FILL } from "./QuestionScreen";

const EASE_SMOOTH = [0.33, 0.72, 0, 1] as const;
const EASE_EXPO = [0.19, 1, 0.22, 1] as const;

/** Same asset as registration backdrop — full-bleed, blurred, behind UI chrome. */
const READY_BG = `/questionscreenimages/${encodeURIComponent("Gemini_Generated_Image_i8attui8attui8at-ezremove.png")}`;

const ASSETS = {
  players: "/questionscreenimages/100.png",
  questions: "/questionscreenimages/8.png",
  prize: "/questionscreenimages/1cr.png",
} as const;

const arial = { fontFamily: "Arial, Helvetica, sans-serif" } as const;

interface ReadyToPlayGateProps {
  onStart: () => void;
}

interface StatTileProps {
  src: string;
  caption: string;
  delay?: number;
}

/** One square tile — ascending stage stats left → right: 8 questions, 100 players, prize. */
function StatTile({ src, caption, delay = 0 }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay, ease: EASE_EXPO }}
      className="flex min-w-0 flex-1 flex-col items-stretch"
    >
      <div
        className="relative aspect-square w-full max-w-[188px] sm:max-w-[228px] md:max-w-[272px] lg:max-w-[308px] xl:max-w-[332px] rounded-xl p-[2.5px] shadow-[0_0_22px_-6px_rgba(228,207,106,0.4),0_12px_28px_-14px_rgba(0,0,0,0.72)]"
        style={{ background: METALLIC_RIM_GRADIENT }}
      >
        <div
          className="relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-[13px]"
          style={PANEL_INNER_FILL}
        >
          <div className="flex min-h-0 flex-1 items-center justify-center px-0.5 pt-1 sm:px-1 sm:pt-1.5 md:px-1.5 md:pt-2">
            <motion.img
              src={src}
              alt=""
              draggable={false}
              className="h-full w-auto max-h-[98%] max-w-[98%] object-contain object-center"
              initial={{ scale: 1.06, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.55, delay: delay + 0.12, ease: EASE_EXPO }}
            />
          </div>
          <span
            className="shrink-0 px-1.5 pb-2.5 pt-0.5 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-white/95 sm:px-2 sm:pb-3 sm:text-[11px] sm:tracking-[0.12em] md:text-xs md:pb-3.5 lg:text-[13px]"
            style={{
              ...arial,
              textShadow: "0 1px 2px rgba(0,0,0,0.85)",
            }}
          >
            {caption}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function DiamondOrnament() {
  return (
    <span className="inline-flex h-2.5 w-2.5 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 items-center justify-center">
      <span
        className="block h-full w-full rotate-45"
        style={{
          background:
            "linear-gradient(135deg, #fff0c2 0%, #e6c45a 45%, #9b7520 100%)",
          boxShadow: "0 0 12px rgba(255,220,140,0.8)",
        }}
      />
    </span>
  );
}

export default function ReadyToPlayGate({ onStart }: ReadyToPlayGateProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[62] flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: EASE_SMOOTH }}
    >
      {/* Blurred full-screen backdrop — scaled so blur doesn’t leave empty edges */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <img
          src={READY_BG}
          alt=""
          draggable={false}
          className="h-full w-full min-h-full min-w-[100%] select-none object-cover object-center"
          style={{
            transform: "scale(1.08)",
            filter: "blur(18px) saturate(112%)",
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.38) 70%, rgba(0,0,0,0.68) 100%)",
        }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 1, delay: 0.05, ease: EASE_SMOOTH }}
        className="pointer-events-none absolute -top-6 -left-6 z-[1] h-32 w-32 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,245,200,0.7) 0%, rgba(255,215,130,0.3) 40%, transparent 75%)",
          filter: "blur(10px)",
          mixBlendMode: "screen",
        }}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 1, delay: 0.05, ease: EASE_SMOOTH }}
        className="pointer-events-none absolute -top-6 -right-6 z-[1] h-32 w-32 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,245,200,0.7) 0%, rgba(255,215,130,0.3) 40%, transparent 75%)",
          filter: "blur(10px)",
          mixBlendMode: "screen",
        }}
        aria-hidden
      />

      <div className="relative z-10 shrink-0 pt-14 md:pt-16" aria-hidden />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-4 md:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE_SMOOTH }}
          className="mb-5 flex items-center gap-3 sm:gap-4 md:mb-8 md:gap-6 lg:gap-8"
        >
          <div
            className="h-px w-12 sm:w-16 md:w-28 lg:w-36"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,220,140,0.75))",
            }}
            aria-hidden
          />
          <DiamondOrnament />
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.5em] text-brass-bright sm:text-[13px] md:text-[18px] lg:text-[22px] md:tracking-[0.45em] lg:tracking-[0.42em]"
            style={arial}
          >
            Tonight's Stage
          </span>
          <DiamondOrnament />
          <div
            className="h-px w-12 sm:w-16 md:w-28 lg:w-36"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,220,140,0.75), transparent)",
            }}
            aria-hidden
          />
        </motion.div>

        <div className="flex w-full max-w-[min(96vw,1040px)] flex-row items-stretch justify-center gap-2.5 sm:gap-4 md:gap-6 lg:gap-8">
          <StatTile src={ASSETS.questions} caption="Questions" delay={0.16} />
          <StatTile src={ASSETS.players} caption="Contestants" delay={0.28} />
          <StatTile src={ASSETS.prize} caption="Cash prize" delay={0.4} />
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 flex-col items-center gap-4 px-4 pb-7 md:pb-10">
        <motion.button
          type="button"
          onClick={onStart}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.72, ease: EASE_SMOOTH }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="game-show-btn relative z-0 cursor-pointer rounded-xl px-12 py-4 text-center text-[13px] font-semibold uppercase tracking-[0.28em] md:px-16 md:py-[18px] md:text-[14px]"
          style={arial}
        >
          <span className="relative z-10">Start the game</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
