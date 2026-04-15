import { NextRequest, NextResponse } from "next/server";

// Server-side only. Keys never leave this route handler.
const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "n8BPVIEYscuwxkbL7EBI";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
          model_id: "eleven_multilingual_v2",
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
      return NextResponse.json(
        { error: "ElevenLabs request failed", detail: errText.slice(0, 300) },
        { status: upstream.status },
      );
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "TTS request failed", detail: String(err) },
      { status: 500 },
    );
  }
}
