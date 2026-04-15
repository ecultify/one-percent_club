"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useScroll, useMotionValueEvent } from "framer-motion";

const FRAME_COUNT = 121;

const getFramePath = (index: number) =>
  `/sharp-frames/frame_${(index + 1).toString().padStart(3, "0")}.jpg`;

export default function ScrollyCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const rafId = useRef<number | null>(null);
  const canvasSized = useRef(false);

  // Preload all frame images
  useEffect(() => {
    let loadedCount = 0;
    const imgs: HTMLImageElement[] = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = getFramePath(i);
      img.onload = () => {
        loadedCount++;
        if (loadedCount === FRAME_COUNT) {
          setImagesLoaded(true);
        }
      };
      imgs.push(img);
    }
    imagesRef.current = imgs;
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

  // Render first frame once loaded
  useEffect(() => {
    if (imagesLoaded) {
      sizeCanvas();
      renderFrame(0);
    }
  }, [imagesLoaded, sizeCanvas, renderFrame]);

  // Handle resize: re-size canvas and re-render current frame
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const handleResize = () => {
      if (!imagesLoaded) return;
      sizeCanvas();
      const progress = scrollYProgress.get();
      const frameIndex = Math.min(
        FRAME_COUNT - 1,
        Math.floor(progress * FRAME_COUNT)
      );
      renderFrame(frameIndex);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imagesLoaded, scrollYProgress, sizeCanvas, renderFrame]);

  // Map scroll progress to frame index with rAF dedup
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!imagesLoaded) return;

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      const frameIndex = Math.min(
        FRAME_COUNT - 1,
        Math.floor(latest * FRAME_COUNT)
      );
      renderFrame(frameIndex);
      rafId.current = null;
    });
  });

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: "500vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="block w-full h-full object-cover"
        />

      </div>

      {/* Loading Indicator — fixed + high z so it sits above the Overlay hero text */}
      {!imagesLoaded && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#121212] z-[100]">
          <p className="text-white/50 text-sm tracking-widest uppercase animate-pulse">
            Buffering Experience...
          </p>
        </div>
      )}
    </div>
  );
}
