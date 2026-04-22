"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** Must match `ScrollyCanvas` / `extract_scroll_frames.py` frame count. */
export const SCROLL_STORY_FRAME_COUNT = 121;

type ScrollScrollyContextValue = {
  scrollyFrameIndex: number;
  setScrollyFrameIndex: (index: number) => void;
};

const ScrollScrollyContext = createContext<ScrollScrollyContextValue | null>(null);

export function ScrollScrollyProvider({ children }: { children: ReactNode }) {
  const [scrollyFrameIndex, setScrollyFrameIndex] = useState(0);
  const value = useMemo(
    () => ({ scrollyFrameIndex, setScrollyFrameIndex }),
    [scrollyFrameIndex],
  );
  return <ScrollScrollyContext.Provider value={value}>{children}</ScrollScrollyContext.Provider>;
}

export function useScrollScrolly() {
  const ctx = useContext(ScrollScrollyContext);
  if (!ctx) {
    return {
      scrollyFrameIndex: 0,
      setScrollyFrameIndex: () => {},
    };
  }
  return ctx;
}
