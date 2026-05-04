"use client";

/* ─────────────────────────────────────────────────────────────────
 *  VideoPlaybackContext
 *  ────────────────────────────────────────────────────────────────
 *  Global "is a foreground video currently playing?" flag.
 *
 *  Set TRUE while a played-once foreground video (question intro,
 *  reaction, final ending) is on screen. Set FALSE otherwise.
 *
 *  Subscribed by GoldDustField + CursorGoldDust + (optionally) Logo3D
 *  to skip their per-frame work while a video plays. This keeps the
 *  main thread + GPU available for video decoding so playback stays
 *  smooth.
 *
 *  IMPORTANT: do NOT set this true for looping background videos
 *  (bgvideo, homepagevideo, HomeIntroVideo loop). Those are decoded
 *  continuously by design and don't compete with foreground decode.
 *  ───────────────────────────────────────────────────────────────── */

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface VideoPlaybackContextValue {
  isVideoPlaying: boolean;
  setVideoPlaying: (playing: boolean) => void;
}

const VideoPlaybackContext = createContext<VideoPlaybackContextValue>({
  isVideoPlaying: false,
  setVideoPlaying: () => {},
});

export function VideoPlaybackProvider({ children }: { children: ReactNode }) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const setVideoPlaying = useCallback((playing: boolean) => {
    setIsVideoPlaying(playing);
  }, []);
  return (
    <VideoPlaybackContext.Provider value={{ isVideoPlaying, setVideoPlaying }}>
      {children}
    </VideoPlaybackContext.Provider>
  );
}

export function useVideoPlayback(): VideoPlaybackContextValue {
  return useContext(VideoPlaybackContext);
}
