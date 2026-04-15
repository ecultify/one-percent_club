"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function Overlay() {
  return (
    <div className="absolute top-0 left-0 w-full h-[500vh] z-10 pointer-events-none">
      {/* Section 1 - Hero */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-6">
        <TextSection
          text="The 1% Club"
          subtext="Do you have what it takes?"
          start={0}
          end={0.15}
        />
      </div>

      {/* Section 2 */}
      <div className="absolute top-[180vh] w-full flex items-center justify-start px-[8%] md:px-[12%]">
        <ParallaxText
          kicker="Round one"
          text="Test your"
          highlight="knowledge."
        />
      </div>

      {/* Section 3 */}
      <div className="absolute top-[320vh] w-full flex items-center justify-end px-[8%] md:px-[12%]">
        <ParallaxText
          kicker="The stakes"
          text="Join the elite"
          highlight="one percent."
          align="end"
        />
      </div>
    </div>
  );
}

function TextSection({ text, subtext, start, end }: { text: string; subtext: string; start: number; end: number }) {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [start, end], [1, 0]);
  const y = useTransform(scrollYProgress, [start, end], [0, -48]);
  const blurPx = useTransform(scrollYProgress, [start, end], [0, 10]);
  const filter = useTransform(blurPx, (b) => `blur(${b}px)`);

  return (
    <motion.div
      style={{ opacity, y, filter }}
      className="text-center pointer-events-auto max-w-4xl"
    >
      <p className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.55em] text-brass-dim/90 mb-8">
        Invitation only
      </p>
      <div className="mx-auto mb-10 h-px w-16 bg-gradient-to-r from-transparent via-brass/50 to-transparent" />
      <h1 className="font-display text-[clamp(2.75rem,10vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-foreground">
        {text}
      </h1>
      <p className="mt-8 max-w-md mx-auto text-base md:text-lg font-medium text-muted leading-relaxed">
        {subtext}
      </p>
    </motion.div>
  );
}

function ParallaxText({
  kicker,
  text,
  highlight,
  align = "start",
}: {
  kicker: string;
  text: string;
  highlight: string;
  align?: "start" | "end";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0.3, 0.5, 0.72], [0, 1, 0]);
  const y = useTransform(scrollYProgress, [0.12, 0.88], [120, -120]);

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y }}
      className={`w-full max-w-xl pointer-events-auto ${align === "end" ? "text-right ml-auto" : "text-left"}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-brass-dim mb-5">{kicker}</p>
      <h2 className="font-display text-[clamp(2rem,6vw,4rem)] font-medium leading-[1.05] tracking-[-0.02em] text-foreground/85">
        {text}{" "}
        <span className="block mt-1 font-semibold text-brass-bright">{highlight}</span>
      </h2>
    </motion.div>
  );
}
