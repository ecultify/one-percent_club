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
  const text = `Hi ${safeName}.`;

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
            voice_settings: {
              // Tuned for name pronunciation consistency.
              // Requested: speed 0.88, stability 50%, similarity high, style 19%.
              speed: 0.88,
              stability: 0.5,
              similarity_boost: 1.0,
              style: 0.19,
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
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
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

