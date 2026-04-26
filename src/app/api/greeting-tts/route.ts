import { NextRequest, NextResponse } from "next/server";
import { getOrCreateTtsMp3, TTS_MODEL_ID } from "@/lib/ttsServerCache";

// Server-side only. Keys never leave this route handler.
const ELEVEN_API_KEY = process.env.ELEVENLABS_GREETING_API_KEY || process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE_ID =
  process.env.ELEVENLABS_GREETING_VOICE_ID ||
  process.env.ELEVENLABS_VOICE_ID ||
  "n8BPVIEYscuwxkbL7EBI";

export const runtime = "nodejs";

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "friend";
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

  try {
    const buf = await getOrCreateTtsMp3(text, ELEVEN_VOICE_ID, async () => {
      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVEN_API_KEY,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: TTS_MODEL_ID,
            language_code: "en",
            // Prime the voice with neutral context so warm-up gibberish
            // doesn't leak into our short greeting. Per ElevenLabs docs,
            // previous_text conditions prosody but is NOT synthesized.
            previous_text: previousText,
            // Auto text normalization handles names + edge cases properly.
            apply_text_normalization: "auto",
            voice_settings: {
              // Tuned to minimize hallucinations on short text:
              //  - stability HIGH = less randomness, less gibberish
              //  - style 0       = no creative interpretation
              //  - speed 1       = natural pace (slower = more drift)
              //  - similarity high = stay locked to the voice
              speed: 1.0,
              stability: 0.7,
              similarity_boost: 0.95,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!upstream.ok) {
        const errText = await upstream.text();
        throw new Error(`ElevenLabs ${upstream.status}: ${errText.slice(0, 400)}`);
      }

      return upstream.arrayBuffer();
    });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        // Short cache so any future greeting-text change propagates within
        // a minute. The server-side TTS cache (ttsServerCache) still
        // shoulders the heavy lifting against ElevenLabs.
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isUpstream = /^ElevenLabs \d+:/.test(msg);
    return NextResponse.json(
      { error: isUpstream ? "ElevenLabs request failed" : "TTS request failed", detail: msg.slice(0, 400) },
      { status: isUpstream ? 502 : 500 },
    );
  }
}

