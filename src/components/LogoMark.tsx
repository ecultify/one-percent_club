"use client";

import { useCallback } from "react";

interface LogoMarkProps {
  /** Fires once the logo artwork has painted. Drives GameFlow's phase machine,
   *  which waits for the brand mark to be ready before flying it to the corner. */
  onReady?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The game's brand mark, rendered as a flat image. Replaces the former 3D GLB
 * logo (Logo3D) — the fly-in / settle choreography still lives in GameFlow;
 * this just paints the artwork and reports when it's on screen.
 */
export default function LogoMark({ onReady, className, style }: LogoMarkProps) {
  // An <img> already in the HTTP cache can finish loading before React attaches
  // onLoad, so that event never fires. The ref callback covers that case by
  // checking `complete` the moment the node mounts.
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete) onReady?.();
    },
    [onReady],
  );

  return (
    <img
      ref={ref}
      src="/ikt-logo.png"
      alt="India Ke Top 1%"
      onLoad={() => onReady?.()}
      draggable={false}
      className={className}
      style={{ objectFit: "contain", pointerEvents: "none", ...style }}
    />
  );
}
