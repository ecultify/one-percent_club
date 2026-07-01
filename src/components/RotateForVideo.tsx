"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * Helpers for playing the landscape teaser/welcome video on a phone held
 * upright: a short "tilt your phone" notice, then the video is rendered
 * rotated 90° so it fills the screen widescreen while the viewport itself
 * stays portrait (works even with the user's rotation-lock on).
 */

/** True on a small portrait viewport (phone held upright). Tracks resizes
 *  and orientation changes, so if the browser itself rotates to landscape
 *  the rotated-video treatment switches off automatically. */
export function useIsPortraitMobile(): boolean {
  const [portraitMobile, setPortraitMobile] = useState(false);
  useEffect(() => {
    const compute = () =>
      setPortraitMobile(window.innerWidth < 768 && window.innerHeight > window.innerWidth);
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);
  return portraitMobile;
}

/** Style for a <video> that should play widescreen inside a PORTRAIT
 *  viewport: swap the axes and rotate the element 90°. */
export const ROTATED_VIDEO_STYLE: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: "100vh",
  height: "100vw",
  transform: "translate(-50%, -50%) rotate(90deg)",
  objectFit: "cover",
};

/** Full-screen "tilt your phone" notice shown for a beat before the
 *  rotated video starts. */
export default function TiltScreenNotice() {
  return (
    <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center bg-black px-8 text-center">
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: [0, 0, 90, 90] }}
        transition={{ duration: 2, times: [0, 0.25, 0.55, 1], repeat: Infinity, ease: "easeInOut" }}
        className="flex h-20 w-12 items-center justify-center rounded-[10px] border-2 border-brass/70"
        style={{ boxShadow: "0 0 28px rgba(228,207,106,0.35)" }}
      >
        <span className="block h-1 w-6 rounded-full bg-brass/60" aria-hidden />
      </motion.div>
      <p
        className="mt-6 text-lg font-semibold text-[#fff4dc]"
        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}
      >
        Tilt your phone sideways
      </p>
      <p className="mt-2 max-w-xs text-sm text-[#f4ecdc]/80">
        The video plays widescreen — turn your phone to watch it in full size.
      </p>
    </div>
  );
}
