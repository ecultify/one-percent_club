"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Small unobtrusive nav overlay rendered on the home page that links to
 * the three live-quiz role entry points. The original solo-demo flow
 * still owns `/` — this overlay just gives the user a way to reach
 * /host, /play and /watch without manually typing the URL. Tucked into
 * the bottom-right and collapsible so it never interferes with the
 * existing intro / scrolly experience.
 */
export default function LiveQuizNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-[200] font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/70">
      {open ? (
        <div className="rounded-lg border border-brass/40 bg-black/80 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-3 pb-2">
            <span className="text-brass/80">Live quiz</span>
            <button
              onClick={() => setOpen(false)}
              className="text-foreground/40 hover:text-foreground/80"
              aria-label="Close live quiz nav"
            >
              ×
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Link href="/host" className="rounded border border-brass/20 px-3 py-1.5 text-center hover:border-brass/60">
              Host
            </Link>
            <Link href="/play" className="rounded border border-brass/20 px-3 py-1.5 text-center hover:border-brass/60">
              Play
            </Link>
            <Link href="/watch" className="rounded border border-brass/20 px-3 py-1.5 text-center hover:border-brass/60">
              Watch
            </Link>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full border border-brass/40 bg-black/60 px-3 py-1.5 hover:border-brass/80 hover:bg-black/80"
        >
          ● Live
        </button>
      )}
    </div>
  );
}
