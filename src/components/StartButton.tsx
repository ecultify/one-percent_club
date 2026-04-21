"use client";

import { motion } from "framer-motion";

/** Public asset; filename uses narrow no-break space before "PM" (macOS screenshot default). */
const START_EXPERIENCE_IMAGE = `/questionscreenimages/${encodeURIComponent(
  "Screenshot 2026-04-16 at 1.47.21\u202fPM.png"
)}`;

interface StartButtonProps {
  onClick: () => void;
}

export default function StartButton({ onClick }: StartButtonProps) {
  return (
    <div className="absolute bottom-[8vh] right-[8vw] z-20 pointer-events-auto">
      <motion.button
        onClick={onClick}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="group relative cursor-pointer"
      >
        {/* Outer glow pulse */}
        <div className="absolute -inset-3 rounded-2xl bg-amber-500/20 blur-xl animate-[glow-pulse_2.5s_ease-in-out_infinite]" />

        {/* Shimmer border */}
        <div className="absolute -inset-[1px] rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-600 via-yellow-300 to-amber-600 animate-[shimmer_3s_linear_infinite] bg-[length:200%_100%]" />
        </div>

        {/* Button body */}
        <div className="relative px-10 py-4 rounded-xl bg-gradient-to-b from-amber-900/90 to-amber-950/95 backdrop-blur-sm">
          {/* Inner highlight */}
          <div className="absolute inset-[1px] rounded-[10px] bg-gradient-to-b from-amber-400/10 to-transparent pointer-events-none" />

          <div className="flex items-center gap-3">
            <img
              src={START_EXPERIENCE_IMAGE}
              alt=""
              className="h-9 w-auto max-w-[min(200px,40vw)] object-contain object-left select-none pointer-events-none"
              draggable={false}
            />
            <span className="text-amber-100 font-bold text-lg tracking-wide uppercase">
              Start Experience
            </span>

            {/* Animated arrow */}
            <motion.svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-amber-300"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <path
                d="M4 10h12m0 0l-4-4m4 4l-4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          </div>
        </div>
      </motion.button>
    </div>
  );
}
