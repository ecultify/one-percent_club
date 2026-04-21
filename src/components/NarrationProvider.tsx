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
  /** Call on a user gesture to unlock programmatic playback. Resolves when the handshake finishes. */
  unlock: () => Promise<void>;
  /** Warm the TTS cache (e.g. on Continue click) so `narrate` can play soon after mount. */
  prefetchTts: (key: string, text: string) => Promise<void>;
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
  if (!res.ok) {
    if (res.status === 500) {
      console.warn(
        "[narrate] /api/tts returned 500 — set ELEVENLABS_API_KEY in .env.local (see README or api/tts/route.ts).",
      );
    }
    throw new Error(`TTS failed: ${res.status}`);
  }
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

  const unlock = useCallback((): Promise<void> => {
    if (unlockedRef.current) return Promise.resolve();
    const a = audioRef.current;
    if (!a) return Promise.resolve();
    // Play a silent (volume=0) blip during the user gesture to unlock the
    // audio element for future programmatic plays. We DO NOT use `a.muted`
    // because the unmute would later happen async (in `then`) and could race
    // with a real `narrate()` that sets src + plays in the meantime — leaving
    // it muted. Setting `volume = 0` doesn't have that race.
    const prevVolume = a.volume;
    a.volume = 0;
    a.src = SILENT_MP3;
    try {
      a.load();
    } catch {
      /* ignore */
    }
    const p = a.play();
    const finish = () => {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      try {
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
      // Don't touch a.src here — leaving it as SILENT_MP3 is fine; narrate()
      // will overwrite it with the real audio URL anyway. Restoring an empty
      // string was racing with narrate() and clobbering its src.
      a.volume = prevVolume || 1;
      unlockedRef.current = true;
    };
    return new Promise<void>((resolve) => {
      const done = () => {
        finish();
        resolve();
      };
      if (p && typeof p.then === "function") {
        p.then(done).catch(() => {
          a.volume = prevVolume || 1;
          unlockedRef.current = true;
          resolve();
        });
      } else {
        done();
      }
    });
  }, []);

  const prefetchTts = useCallback(async (key: string, text: string): Promise<void> => {
    const cacheKey = `${key}:${textHash(text)}`;
    if (audioCache.has(cacheKey)) return;
    try {
      const url = await fetchAudioBlob(text);
      audioCache.set(cacheKey, url);
    } catch (err) {
      console.warn("[prefetchTts] failed:", err);
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
    () => ({ muted, toggleMute, narrate, stop, unlock, prefetchTts, isSpeaking }),
    [muted, toggleMute, narrate, stop, unlock, prefetchTts, isSpeaking],
  );

  return <NarrationContext.Provider value={value}>{children}</NarrationContext.Provider>;
}

export function useNarration(): NarrationContextValue {
  const ctx = useContext(NarrationContext);
  if (!ctx) throw new Error("useNarration must be used within NarrationProvider");
  return ctx;
}
