"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

interface NarrationContextValue {
  muted: boolean;
  toggleMute: () => void;
  /**
   * Speak the given text. If muted, becomes a no-op.
   * `key` caches audio client-side so repeat calls don't re-hit the API.
   */
  narrate: (key: string, text: string) => Promise<void>;
  /** Stop any currently playing narration immediately. */
  stop: () => void;
  /** Call once on a real user gesture (e.g. Start button click) to unlock audio. */
  unlock: () => void;
  /** True while narration is audible. */
  isSpeaking: boolean;
}

const NarrationContext = createContext<NarrationContextValue | null>(null);

// Module-level cache so blob URLs persist across component unmounts.
const audioCache = new Map<string, string>();

/**
 * Lightweight string hash. Used to bust the cache when narration text changes
 * under the same logical key (e.g. "q-1" text was edited — don't serve stale audio).
 */
function textHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

async function fetchAudioBlob(text: string): Promise<string> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// 1x1 silent mp3 data URI — used to "unlock" audio playback on initial user gesture
const SILENT_MP3 =
  "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";

export function NarrationProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Persistent single audio element — reused for all narrations
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Sequence token — cancels stale in-flight narrations
  const seqRef = useRef(0);

  // Restore mute preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("narration-muted");
      if (saved === "1") setMuted(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Ensure a persistent <audio> element exists (created on client only)
  useEffect(() => {
    if (audioRef.current) return;
    const a = new Audio();
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    audioRef.current = a;

    const onEnded = () => setIsSpeaking(false);
    const onPause = () => setIsSpeaking(false);
    const onPlay = () => setIsSpeaking(true);
    a.addEventListener("ended", onEnded);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);

    return () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
      a.pause();
    };
  }, []);

  const stop = useCallback(() => {
    // Invalidate any in-flight narrate()
    seqRef.current += 1;
    const a = audioRef.current;
    if (a) {
      a.pause();
      try { a.currentTime = 0; } catch { /* ignore */ }
    }
    setIsSpeaking(false);
  }, []);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    // Play a silent blip during the user gesture to unlock the element for future plays
    const prevSrc = a.src;
    a.src = SILENT_MP3;
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        a.pause();
        try { a.currentTime = 0; } catch { /* ignore */ }
        a.muted = false;
        if (prevSrc) a.src = prevSrc;
        unlockedRef.current = true;
      }).catch(() => {
        // Even if it failed, mark as attempted; future plays may still work
        a.muted = false;
        unlockedRef.current = true;
      });
    } else {
      a.muted = false;
      unlockedRef.current = true;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem("narration-muted", next ? "1" : "0"); } catch { /* ignore */ }
      if (next) {
        // Muting: hard stop
        seqRef.current += 1;
        const a = audioRef.current;
        if (a) {
          a.pause();
          try { a.currentTime = 0; } catch { /* ignore */ }
        }
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  const narrate = useCallback(async (key: string, text: string): Promise<void> => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;

    // Bump sequence — this call owns playback from here
    const mySeq = ++seqRef.current;

    // Hard stop any currently playing audio
    a.pause();
    try { a.currentTime = 0; } catch { /* ignore */ }

    try {
      // Compose cache key from logical key + hash of actual text.
      // If the text changes, the hash changes → cache miss → fresh audio.
      const cacheKey = `${key}:${textHash(text)}`;

      let url = audioCache.get(cacheKey);
      if (!url) {
        url = await fetchAudioBlob(text);
        audioCache.set(cacheKey, url);
      }

      // Was this request superseded while we were fetching?
      if (mySeq !== seqRef.current) return;
      if (mutedRef.current) return;

      a.src = url;

      // Return a promise that resolves when the audio finishes, is replaced,
      // or errors. Callers can await this to sync UI with audio timing.
      return await new Promise<void>((resolve) => {
        const cleanup = () => {
          a.removeEventListener("ended", onEnded);
          a.removeEventListener("error", onError);
        };
        const onEnded = () => {
          // Only resolve if this is still the latest request
          if (mySeq === seqRef.current) {
            cleanup();
            resolve();
          }
        };
        const onError = () => {
          cleanup();
          resolve();
        };
        a.addEventListener("ended", onEnded);
        a.addEventListener("error", onError);

        // Watchdog — if sequence bumps, resolve quickly to unblock awaiters
        const watchdog = setInterval(() => {
          if (mySeq !== seqRef.current) {
            clearInterval(watchdog);
            cleanup();
            resolve();
          }
        }, 120);
        // Tie watchdog to event cleanup
        a.addEventListener("ended", () => clearInterval(watchdog), { once: true });
        a.addEventListener("error", () => clearInterval(watchdog), { once: true });

        a.play().catch((err) => {
          console.warn("[narrate] play blocked:", err);
          clearInterval(watchdog);
          cleanup();
          setIsSpeaking(false);
          resolve();
        });
      });
    } catch (err) {
      console.warn("[narrate] failed:", err);
      setIsSpeaking(false);
    }
  }, []);

  const value = useMemo<NarrationContextValue>(
    () => ({ muted, toggleMute, narrate, stop, unlock, isSpeaking }),
    [muted, toggleMute, narrate, stop, unlock, isSpeaking],
  );

  return <NarrationContext.Provider value={value}>{children}</NarrationContext.Provider>;
}

export function useNarration(): NarrationContextValue {
  const ctx = useContext(NarrationContext);
  if (!ctx) throw new Error("useNarration must be used within NarrationProvider");
  return ctx;
}
