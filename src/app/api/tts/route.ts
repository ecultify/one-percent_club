import { NextRequest, NextResponse } from "next/server";
import { getOrCreateTtsMp3, TTS_MODEL_ID } from "@/lib/ttsServerCache";

// Server-side only. Keys never leave this route handler.
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "n8BPVIEYscuwxkbL7EBI";

const TTS_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_TTS === "1" ||
  process.env.NEXT_PUBLIC_DISABLE_TTS?.toLowerCase() === "true";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (TTS_DISABLED) {
    return NextResponse.json({ error: "TTS disabled (NEXT_PUBLIC_DISABLE_TTS)" }, { status: 503 });
  }

  if (!ELEVEN_API_KEY) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  let text: string;
  try {
    const body = await req.json();
    text = String(body.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  // Cap to avoid absurd requests
  if (text.length > 1500) {
    return NextResponse.json({ error: "Text too long" }, { status: 400 });
  }

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
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.35,
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
        // Audio is deterministic for a given voice + model + text; safe to cache aggressively on the client.
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
