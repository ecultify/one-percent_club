import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/** Voice + model must be part of the key so cache invalidates if route settings change. */
const TTS_MODEL_ID = "eleven_multilingual_v2";

const MAX_MEMORY_ENTRIES = 96;

const memoryLru = new Map<string, Buffer>();

/** Parallel POSTs for the same text share one ElevenLabs round-trip. */
const inflight = new Map<string, Promise<Buffer>>();

function touchMemory(key: string, buf: Buffer) {
  memoryLru.delete(key);
  memoryLru.set(key, buf);
  while (memoryLru.size > MAX_MEMORY_ENTRIES) {
    const oldest = memoryLru.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    memoryLru.delete(oldest);
  }
}

function cacheDir(): string {
  if (process.env.TTS_CACHE_DIR) return process.env.TTS_CACHE_DIR;
  // Vercel: only /tmp is writable in Node functions.
  if (process.env.VERCEL) return join(tmpdir(), "one-percent-tts-cache");
  return join(process.cwd(), ".cache", "tts");
}

export function ttsCacheKey(text: string, voiceId: string): string {
  return createHash("sha256")
    .update(`${voiceId}\0${TTS_MODEL_ID}\0${text}`, "utf8")
    .digest("hex");
}

async function readDisk(key: string): Promise<Buffer | null> {
  const dir = cacheDir();
  const file = join(dir, `${key}.mp3`);
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

async function writeDisk(key: string, buf: Buffer): Promise<void> {
  const dir = cacheDir();
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${key}.mp3`);
  await writeFile(file, buf);
}

/**
 * Returns MP3 bytes for `text`, using memory → disk → `fetchMp3()` (ElevenLabs).
 * Deduplicates concurrent requests with the same cache key.
 */
export async function getOrCreateTtsMp3(
  text: string,
  voiceId: string,
  fetchMp3: () => Promise<ArrayBuffer>,
): Promise<Buffer> {
  const key = ttsCacheKey(text, voiceId);

  const mem = memoryLru.get(key);
  if (mem) {
    touchMemory(key, mem);
    return mem;
  }

  const fromDisk = await readDisk(key);
  if (fromDisk) {
    touchMemory(key, fromDisk);
    return fromDisk;
  }

  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      const ab = await fetchMp3();
      const buf = Buffer.from(ab);
      touchMemory(key, buf);
      try {
        await writeDisk(key, buf);
      } catch {
        /* disk full or read-only — memory hit still works */
      }
      return buf;
    })().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, p);
  }

  return p;
}

export { TTS_MODEL_ID };
