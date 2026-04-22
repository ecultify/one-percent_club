"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useScroll, useMotionValueEvent } from "framer-motion";
import { SCROLL_STORY_FRAME_COUNT, useScrollScrolly } from "@/contexts/ScrollScrollyContext";

/** Frames from `scrollvideo.mp4` (bottom band cropped off; see `scripts/extract_scroll_frames.py`). */
const FRAME_COUNT = SCROLL_STORY_FRAME_COUNT;

const getFramePath = (index: number) =>
  `/sharp-frames/frame_${(index + 1).toString().padStart(3, "0")}.jpg`;

export default function ScrollyCanvas() {
  const { setScrollyFrameIndex } = useScrollScrolly();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const rafId = useRef<number | null>(null);
  const canvasSized = useRef(false);

  useLayoutEffect(() => {
    setPortalReady(true);
  }, []);

  // Preload all frame images (count errors too so a missing frame never blocks the page)
  useEffect(() => {
    let settledCount = 0;
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    let maxWaitId: number;

    const finish = () => {
      if (cancelled) return;
      window.clearTimeout(maxWaitId);
      setImagesLoaded(true);
    };

    const bump = () => {
      settledCount++;
      if (settledCount >= FRAME_COUNT) {
        finish();
      }
    };

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = getFramePath(i);
      img.onload = bump;
      img.onerror = bump;
      imgs.push(img);
    }
    imagesRef.current = imgs;

    // Never hang forever if frames are missing, slow CDN, or callbacks never fire
    maxWaitId = window.setTimeout(finish, 12_000) as unknown as number;

    return () => {
      cancelled = true;
      window.clearTimeout(maxWaitId);
    };
  }, []);

  // Size canvas to window respecting devicePixelRatio for Retina sharpness
  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Set the actual drawing buffer to physical pixel size
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    // Keep the CSS size at logical pixel size
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvasSized.current = true;
  }, []);

  // Render a specific frame with cover-fit scaling
  const renderFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const images = imagesRef.current;
    if (!canvas || !images[index]) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!canvasSized.current) sizeCanvas();

    const img = images[index];
    const ratio = Math.max(
      canvas.width / img.width,
      canvas.height / img.height
    );
    const newWidth = img.width * ratio;
    const newHeight = img.height * ratio;
    const offsetX = (canvas.width - newWidth) / 2;
    const offsetY = (canvas.height - newHeight) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);
  }, [sizeCanvas]);

  const publishFrameIndex = useCallback(
    (latest: number) => {
      const frameIndex = Math.min(FRAME_COUNT - 1, Math.floor(latest * FRAME_COUNT));
      setScrollyFrameIndex(frameIndex);
      return frameIndex;
    },
    [setScrollyFrameIndex],
  );

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Render first frame once loaded
  useEffect(() => {
    if (imagesLoaded) {
      sizeCanvas();
      const progress = scrollYProgress.get();
      const frameIndex = publishFrameIndex(progress);
      renderFrame(frameIndex);
    }
  }, [imagesLoaded, sizeCanvas, renderFrame, publishFrameIndex, scrollYProgress]);

  // Handle resize: re-size canvas and re-render current frame
  useEffect(() => {
    const handleResize = () => {
      if (!imagesLoaded) return;
      sizeCanvas();
      const progress = scrollYProgress.get();
      const frameIndex = publishFrameIndex(progress);
      renderFrame(frameIndex);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imagesLoaded, scrollYProgress, sizeCanvas, renderFrame, publishFrameIndex]);

  // Map scroll progress to frame index with rAF dedup
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!imagesLoaded) return;

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      const frameIndex = publishFrameIndex(latest);
      renderFrame(frameIndex);
      rafId.current = null;
    });
  });

  const bufferingOverlay =
    portalReady && !imagesLoaded
      ? createPortal(
          <div
            className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center bg-[#0a0a0a]"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="animate-pulse text-sm uppercase tracking-widest text-white/60">
              Buffering Experience...
            </p>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: "500vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="block w-full h-full object-cover"
        />

      </div>

      {/* Loading UI is portaled to body so it always stacks above Overlay (“The 1% Club”) */}
      {bufferingOverlay}
    </div>
  );
}
