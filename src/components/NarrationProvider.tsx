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
import { runSecondaryAudioUnlocks } from "@/lib/secondaryAudioUnlock";

interface NarrationContextValue {
  muted: boolean;
  toggleMute: () => void;
  narrate: (key: string, text: string) => Promise<void>;
  /** Play a static audio file (e.g. pre-recorded VO). Works even when TTS is disabled. */
  narrateUrl: (key: string, src: string) => Promise<void>;
  stop: () => void;
  unlock: () => Promise<void>;
  prefetchTts: (key: string, text: string) => Promise<void>;
  prefetchAudioUrl: (src: string) => Promise<void>;
  isSpeaking: boolean;
}

const NarrationContext = createContext<NarrationContextValue | null>(null);

const TTS_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_TTS === "1" ||
  process.env.NEXT_PUBLIC_DISABLE_TTS?.toLowerCase() === "true";

const audioCache = new Map<string, string>();

const inflightBlob = new Map<string, Promise<string>>();

const SILENT_MP3 =
  "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";

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

async function getBlobUrlCached(cacheKey: string, text: string): Promise<string> {
  const hit = audioCache.get(cacheKey);
  if (hit) return hit;
  let p = inflightBlob.get(cacheKey);
  if (!p) {
    p = fetchAudioBlob(text)
      .then((url) => {
        audioCache.set(cacheKey, url);
        return url;
      })
      .finally(() => {
        inflightBlob.delete(cacheKey);
      });
    inflightBlob.set(cacheKey, p);
  }
  return p;
}

export function NarrationProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const seqRef = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("narration-muted");
      if (saved === "1") setMuted(true);
    } catch {}
  }, []);

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
    seqRef.current += 1;
    const a = audioRef.current;
    if (a) {
      a.pause();
      try {
        a.currentTime = 0;
      } catch {}
    }
    setIsSpeaking(false);
  }, []);

  const unlock = useCallback((): Promise<void> => {
    runSecondaryAudioUnlocks();

    if (unlockedRef.current) return Promise.resolve();
    const a = audioRef.current;
    if (!a) return Promise.resolve();
    const prevVolume = a.volume;
    a.volume = 0;
    a.src = SILENT_MP3;
    try {
      a.load();
    } catch {}
    const p = a.play();
    const finish = () => {
      try {
        a.pause();
      } catch {}
      try {
        a.currentTime = 0;
      } catch {}
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
    if (TTS_DISABLED) return;
    const cacheKey = `${key}:${textHash(text)}`;
    try {
      await getBlobUrlCached(cacheKey, text);
    } catch (err) {
      console.warn("[prefetchTts] failed:", err);
    }
  }, []);

  const prefetchAudioUrl = useCallback(async (src: string): Promise<void> => {
    try {
      const res = await fetch(src);
      if (res.ok) await res.blob();
    } catch (err) {
      console.warn("[prefetchAudioUrl] failed:", err);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("narration-muted", next ? "1" : "0");
      } catch {}
      if (next) {
        seqRef.current += 1;
        const a = audioRef.current;
        if (a) {
          a.pause();
          try {
            a.currentTime = 0;
          } catch {}
        }
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  const narrate = useCallback(async (key: string, text: string): Promise<void> => {
    if (mutedRef.current) return;
    if (TTS_DISABLED) return;
    const a = audioRef.current;
    if (!a) return;

    const mySeq = ++seqRef.current;

    a.pause();
    try {
      a.currentTime = 0;
    } catch {}

    try {
      const cacheKey = `${key}:${textHash(text)}`;

      const url = await getBlobUrlCached(cacheKey, text);

      if (mySeq !== seqRef.current) return;
      if (mutedRef.current) return;

      a.src = url;

      return await new Promise<void>((resolve) => {
        const cleanup = () => {
          a.removeEventListener("ended", onEnded);
          a.removeEventListener("error", onError);
        };
        const onEnded = () => {
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

        const watchdog = setInterval(() => {
          if (mySeq !== seqRef.current) {
            clearInterval(watchdog);
            cleanup();
            resolve();
          }
        }, 120);
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

  const narrateUrl = useCallback(async (_key: string, src: string): Promise<void> => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;

    const mySeq = ++seqRef.current;

    a.pause();
    try {
      a.currentTime = 0;
    } catch {}

    if (mySeq !== seqRef.current) return;
    if (mutedRef.current) return;

    a.src = src;

    return await new Promise<void>((resolve) => {
      const cleanup = () => {
        a.removeEventListener("ended", onEnded);
        a.removeEventListener("error", onError);
      };
      const onEnded = () => {
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

      const watchdog = setInterval(() => {
        if (mySeq !== seqRef.current) {
          clearInterval(watchdog);
          cleanup();
          resolve();
        }
      }, 120);
      a.addEventListener("ended", () => clearInterval(watchdog), { once: true });
      a.addEventListener("error", () => clearInterval(watchdog), { once: true });

      a.play().catch((err) => {
        console.warn("[narrateUrl] play blocked:", err);
        clearInterval(watchdog);
        cleanup();
        setIsSpeaking(false);
        resolve();
      });
    });
  }, []);

  const value = useMemo<NarrationContextValue>(
    () => ({
      muted,
      toggleMute,
      narrate,
      narrateUrl,
      stop,
      unlock,
      prefetchTts,
      prefetchAudioUrl,
      isSpeaking,
    }),
    [muted, toggleMute, narrate, narrateUrl, stop, unlock, prefetchTts, prefetchAudioUrl, isSpeaking],
  );

  return <NarrationContext.Provider value={value}>{children}</NarrationContext.Provider>;
}

export function useNarration(): NarrationContextValue {
  const ctx = useContext(NarrationContext);
  if (!ctx) throw new Error("useNarration must be used within NarrationProvider");
  return ctx;
}
