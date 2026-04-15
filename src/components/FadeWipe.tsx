"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * Full-screen right-to-left wipe to black. Used between phases of the
 * game (question intro video → question screen → reaction video etc.)
 * so transitions never feel abrupt.
 *
 * Usage: render <FadeWipe active={boolean} /> and flip `active` to true
 * for roughly 500ms while you swap the underlying content, then flip it
 * back to false.
 */
export default function FadeWipe({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="fade-wipe"
          className="fixed inset-0 z-[95] pointer-events-none bg-black"
          initial={{ clipPath: "inset(0 0 0 100%)" }}     // fully hidden on the left
          animate={{ clipPath: "inset(0 0 0 0%)" }}       // fully covering
          exit={{ clipPath: "inset(0 100% 0 0)" }}        // clears to the left
          transition={{ duration: 0.5, ease: [0.7, 0, 0.3, 1] }}
        />
      )}
    </AnimatePresence>
  );
}
