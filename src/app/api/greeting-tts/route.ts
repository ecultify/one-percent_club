import { NextRequest, NextResponse } from "next/server";
import { getOrCreateTtsMp3, TTS_MODEL_ID, TTS_MODEL_ID_V3 } from "@/lib/ttsServerCache";

// Server-side only. Keys never leave this route handler.
const ELEVEN_API_KEY = process.env.ELEVENLABS_GREETING_API_KEY || process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE_ID =
  process.env.ELEVENLABS_GREETING_VOICE_ID ||
  process.env.ELEVENLABS_VOICE_ID ||
  "n8BPVIEYscuwxkbL7EBI";

export const runtime = "nodejs";

/**
 * Once v3 fails for the current process, stop spamming the upstream with
 * doomed v3 requests for the rest of the process lifetime — every request
 * will go straight to v2. Reset on next deploy / cold start.
 */
let v3KnownBroken = false;

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "friend";
}

interface ElevenFetchOpts {
  apiKey: string;
  voiceId: string;
  body: Record<string, unknown>;
}

async function fetchElevenMp3(opts: ElevenFetchOpts): Promise<ArrayBuffer> {
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": opts.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(opts.body),
    },
  );

  if (!upstream.ok) {
    const errText = await upstream.text();
    throw new Error(`ElevenLabs ${upstream.status}: ${errText.slice(0, 400)}`);
  }

  return upstream.arrayBuffer();
}

export async function GET(req: NextRequest) {
  if (!ELEVEN_API_KEY) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  const name = firstNameOf(req.nextUrl.searchParams.get("name") ?? "");
  // Keep it simple: avoid Unicode property escapes (TS target may be < ES2018).
  const safeName = name.replace(/[^a-zA-Z0-9'-]/g, "").slice(0, 26) || "friend";
  // Just the greeting, nothing else. The welcome / "ab suniye" beats
  // belong on the slides that follow, not in the name greeting.
  const text = `Hello ${safeName}.`;
  // `previous_text` primes the voice model BEFORE it reaches our greeting.
  // Without it, ElevenLabs spends ~0.5s warming up its prosody and that
  // warm-up bleeds into short outputs as gibberish. This context is never
  // synthesized — it's just used to condition the voice.
  const previousText = "Welcome to the show. The host steps up to the microphone.";

  // Used to surface which model actually answered the request, both in the
  // response header (handy in DevTools) and in the v3-failure log line.
  let modelUsed: string = TTS_MODEL_ID_V3;
  let v3ErrorMessage: string | null = null;

  // ─── v3 attempt ────────────────────────────────────────────────────────
  // Minimal body — v3 has stricter param validation than v2 and rejects some
  // fields (e.g. `apply_text_normalization`, `language_code`) on certain
  // accounts. Keep this lean to maximise the chance v3 actually answers.
  const tryV3 = async () =>
    getOrCreateTtsMp3(
      text,
      ELEVEN_VOICE_ID,
      () =>
        fetchElevenMp3({
          apiKey: ELEVEN_API_KEY!,
          voiceId: ELEVEN_VOICE_ID,
          body: {
            text,
            model_id: TTS_MODEL_ID_V3,
            voice_settings: {
              // v3's stability is categorical: 0=Creative, 0.5=Natural, 1=Robust.
              stability: 0.5,
              similarity_boost: 0.95,
              style: 0.0,
              use_speaker_boost: true,
            },
          },
        }),
      TTS_MODEL_ID_V3,
    );

  // ─── v2 attempt (fallback) ─────────────────────────────────────────────
  // Same shape as before this whole change, plus the priming context that
  // kept short-name greetings from gibbering on warm-up.
  const tryV2 = async () =>
    getOrCreateTtsMp3(
      text,
      ELEVEN_VOICE_ID,
      () =>
        fetchElevenMp3({
          apiKey: ELEVEN_API_KEY!,
          voiceId: ELEVEN_VOICE_ID,
          body: {
            text,
            model_id: TTS_MODEL_ID,
            language_code: "en",
            previous_text: previousText,
            apply_text_normalization: "auto",
            voice_settings: {
              speed: 1.0,
              stability: 0.7,
              similarity_boost: 0.95,
              style: 0.0,
              use_speaker_boost: true,
            },
          },
        }),
      TTS_MODEL_ID,
    );

  let buf: Buffer | null = null;

  if (!v3KnownBroken) {
    try {
      buf = await tryV3();
      modelUsed = TTS_MODEL_ID_V3;
    } catch (v3Err) {
      v3ErrorMessage = v3Err instanceof Error ? v3Err.message : String(v3Err);
      // 4xx errors mean v3 will keep failing for this account / config —
      // flip the kill-switch so we stop hammering the upstream. 5xx is
      // transient; we leave the switch off and let the next request retry.
      const isClientError = /^ElevenLabs 4\d\d:/.test(v3ErrorMessage);
      if (isClientError) v3KnownBroken = true;
      console.warn(
        `[greeting-tts] v3 failed (kill-switch=${v3KnownBroken}); falling back to v2: ${v3ErrorMessage}`,
      );
    }
  }

  if (!buf) {
    try {
      buf = await tryV2();
      modelUsed = TTS_MODEL_ID;
    } catch (v2Err) {
      const v2Msg = v2Err instanceof Error ? v2Err.message : String(v2Err);
      const isUpstream = /^ElevenLabs \d+:/.test(v2Msg);
      return NextResponse.json(
        {
          error: isUpstream ? "ElevenLabs request failed" : "TTS request failed",
          detail: v2Msg.slice(0, 400),
          // Surface the v3 failure too so a single response gives full debug context.
          v3Error: v3ErrorMessage?.slice(0, 200) ?? null,
        },
        { status: isUpstream ? 502 : 500 },
      );
    }
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      // Short cache so any future greeting-text change propagates within
      // a minute. The server-side TTS cache (ttsServerCache) still
      // shoulders the heavy lifting against ElevenLabs.
      "Cache-Control": "public, max-age=60, must-revalidate",
      // Helpful in DevTools to confirm which model actually served the audio.
      "X-Tts-Model": modelUsed,
    },
  });
}
