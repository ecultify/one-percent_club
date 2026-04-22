"use client";

import { useEffect, useRef } from "react";
import { useNarration } from "./NarrationProvider";
import { playMetallicClick } from "@/lib/uiClickSound";

export default function UiClickSound() {
  const { muted } = useNarration();
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (mutedRef.current) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-no-ui-click]")) return;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      const hit = t.closest(
        "button, [role='button'], .game-show-btn, a[href]:not([href='#'])",
      );
      if (!hit) return;
      if (hit.hasAttribute("disabled")) return;
      playMetallicClick();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
