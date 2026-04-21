"use client";

import { motion } from "framer-motion";

const EASE_SMOOTH = [0.33, 0.72, 0, 1] as const;
const EASE_EXPO = [0.19, 1, 0.22, 1] as const;

const READY_BG = `/questionscreenimages/${encodeURIComponent("rweadytoplay.png")}`;

const ASSETS = {
  players: "/questionscreenimages/100.png",
  questions: "/questionscreenimages/8.png",
  prize: "/questionscreenimages/1cr.png",
} as const;

const arial = { fontFamily: "Arial, Helvetica, sans-serif" } as const;

const METALLIC_RIM =
  "linear-gradient(180deg, #fff0c2 0%, #f4dc7c 22%, #e6c45a 42%, #b28622 72%, #6d4e13 92%, #3a2708 100%)";

interface ReadyToPlayGateProps {
  onStart: () => void;
}

interface HeroPillarProps {
  src: string;
  label: string;
  caption: string;
  delay?: number;
  emphasis?: boolean;
}

function HeroPillar({ src, label, caption, delay = 0, emphasis = false }: HeroPillarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE_EXPO }}
      className={`group relative flex w-full flex-col items-center ${
        emphasis ? "md:-translate-y-5" : ""
      }`}
    >
      {/* Spotlight beam streaming down from above the pillar */}
      <motion.div
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 -z-0"
        initial={{ opacity: 0, scaleY: 0.6 }}
        animate={{ opacity: emphasis ? 0.95 : 0.75, scaleY: 1 }}
        transition={{ duration: 1.2, delay: delay + 0.1, ease: EASE_SMOOTH }}
        style={{
          width: emphasis ? "150%" : "130%",
          height: "120%",
          transformOrigin: "top center",
          mixBlendMode: "screen",
          background: emphasis
            ? "conic-gradient(from 180deg at 50% -10%, transparent 0deg, rgba(255,230,160,0.55) 168deg, rgba(255,210,110,0.15) 186deg, transparent 360deg)"
            : "conic-gradient(from 180deg at 50% -10%, transparent 0deg, rgba(255,225,150,0.42) 170deg, rgba(255,200,110,0.12) 184deg, transparent 360deg)",
          filter: "blur(12px)",
        }}
        aria-hidden
      />

      {/* Halo glow behind image */}
      <div
        className="pointer-events-none absolute left-1/2 top-[28%] h-[72%] w-[85%] -translate-x-1/2 rounded-full opacity-80 blur-2xl"
        style={{
          background: emphasis
            ? "radial-gradient(closest-side, rgba(255,200,96,0.55), rgba(255,150,40,0.16) 55%, transparent 75%)"
            : "radial-gradient(closest-side, rgba(255,210,130,0.38), rgba(200,150,60,0.12) 55%, transparent 75%)",
        }}
        aria-hidden
      />

      {/* Metallic rim → dark interior (matches question-panel language) */}
      <div
        className="relative w-full rounded-2xl p-[2px] overflow-hidden"
        style={{
          background: METALLIC_RIM,
          boxShadow:
            "0 18px 48px -18px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.55), 0 0 28px -6px rgba(228,207,106,0.25)",
        }}
      >
        <div
          className="relative flex w-full flex-col items-center rounded-[14px] px-4 pt-6 pb-4 md:pt-9 md:pb-6 md:px-6"
          style={{
            background:
              "linear-gradient(180deg, rgba(28,20,8,0.82) 0%, rgba(6,4,2,0.92) 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,225,150,0.2), inset 0 -1px 0 rgba(0,0,0,0.6), inset 0 0 36px rgba(0,0,0,0.5)",
          }}
        >
          {/* subtle sheen at the top edge */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-14"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,230,170,0.16), transparent)",
            }}
            aria-hidden
          />

          <motion.img
            src={src}
            alt=""
            draggable={false}
            className={`relative z-10 w-auto object-contain ${
              emphasis
                ? "h-40 sm:h-48 md:h-60 lg:h-72"
                : "h-32 sm:h-40 md:h-52 lg:h-64"
            }`}
            style={{
              filter:
                "drop-shadow(0 14px 24px rgba(0,0,0,0.85)) drop-shadow(0 0 22px rgba(255,200,110,0.38))",
            }}
            initial={{ scale: 1.3, opacity: 0, filter: "blur(6px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.75, delay: delay + 0.18, ease: EASE_EXPO }}
          />

          <div className="relative z-10 mt-3 flex w-full flex-col items-center gap-1 md:mt-4">
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.35em] text-brass-dim md:text-[10px]"
              style={arial}
            >
              {label}
            </span>
            <span
              className="text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-white md:text-[13px]"
              style={arial}
            >
              {caption}
            </span>
          </div>

          {/* bottom rim highlight */}
          <div
            className="pointer-events-none absolute inset-x-6 bottom-1 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,220,140,0.6), transparent)",
            }}
            aria-hidden
          />
        </div>
      </div>

      {/* Pedestal — shallow elliptical base so the pillar feels "grounded" on stage */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0.5 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.35, ease: EASE_SMOOTH }}
        className="relative mt-2 h-3 w-[72%] md:h-4 md:w-[78%]"
        aria-hidden
      >
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,220,140,0.35) 0%, rgba(255,200,110,0.15) 40%, transparent 75%)",
            filter: "blur(6px)",
            mixBlendMode: "screen",
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[2px] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,235,170,0.75), transparent)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}

/** Small diamond ornament used as a section divider, like a game-show flourish. */
function DiamondOrnament() {
  return (
    <span className="inline-flex h-2 w-2 md:h-2.5 md:w-2.5 items-center justify-center">
      <span
        className="block h-full w-full rotate-45"
        style={{
          background:
            "linear-gradient(135deg, #fff0c2 0%, #e6c45a 45%, #9b7520 100%)",
          boxShadow: "0 0 10px rgba(255,220,140,0.7)",
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
      <img
        src={READY_BG}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center select-none"
        draggable={false}
      />
      {/* darker vignette + subtle warm overlay so pillars pop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/75" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.72) 100%)",
        }}
        aria-hidden
      />

      {/* Corner spotlight bulbs — sells the stage */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 1, delay: 0.05, ease: EASE_SMOOTH }}
        className="pointer-events-none absolute -top-6 -left-6 h-32 w-32 rounded-full"
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
        className="pointer-events-none absolute -top-6 -right-6 h-32 w-32 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,245,200,0.7) 0%, rgba(255,215,130,0.3) 40%, transparent 75%)",
          filter: "blur(10px)",
          mixBlendMode: "screen",
        }}
        aria-hidden
      />

      <div className="relative z-10 shrink-0 pt-20 md:pt-24" aria-hidden />

      {/* Main stage with the 3 hero pillars */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-4 md:px-10 lg:px-16">
        {/* Gold ornamental divider — diamond • line • text • line • diamond */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE_SMOOTH }}
          className="mb-5 flex items-center gap-3 md:mb-8 md:gap-5"
        >
          <div
            className="h-px w-14 md:w-20"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,220,140,0.75))",
            }}
            aria-hidden
          />
          <DiamondOrnament />
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.5em] text-brass-bright md:text-[11px]"
            style={arial}
          >
            Tonight's Stage
          </span>
          <DiamondOrnament />
          <div
            className="h-px w-14 md:w-20"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,220,140,0.75), transparent)",
            }}
            aria-hidden
          />
        </motion.div>

        <div className="grid w-full max-w-[1080px] grid-cols-3 items-end gap-3 sm:gap-5 md:gap-8 lg:gap-10">
          <HeroPillar
            src={ASSETS.players}
            label="The Arena"
            caption="Players Ready"
            delay={0.18}
          />
          {/* Center prize pillar crashes in LAST with biggest impact */}
          <HeroPillar
            src={ASSETS.prize}
            label="The Prize"
            caption="Ek Hi Inaam"
            delay={0.42}
            emphasis
          />
          <HeroPillar
            src={ASSETS.questions}
            label="The Test"
            caption="Sawaal Zindagi Badal De"
            delay={0.3}
          />
        </div>
      </div>

      {/* CTA + tagline */}
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.88, ease: EASE_SMOOTH }}
          className="mx-auto max-w-2xl text-center text-sm font-medium leading-relaxed text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] md:text-base"
          style={arial}
        >
          Sirf Woh Jo Dimaag Aur Dil Se Khelte Hain
        </motion.p>
      </div>
    </motion.div>
  );
}
