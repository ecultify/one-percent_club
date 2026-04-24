import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userAnswer, correctAnswer, question } = await req.json();

    if (!userAnswer || !correctAnswer) {
      return NextResponse.json({ isCorrect: false }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY not set");
      return NextResponse.json({ isCorrect: true, fallback: true });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an answer checker for a quiz game. Decide whether the user's answer is semantically equivalent to, or semantically contains, the correct answer. Be LENIENT — accept partial matches, paraphrases, Hindi/English translations, synonyms, and answers that mention the key concept even if not the exact word. Respond ONLY with YES or NO, no other text.",
          },
          {
            role: "user",
            content: `Question: ${question}\nCorrect answer: ${correctAnswer}\nUser's typed answer: ${userAnswer}\n\nDoes the user's answer match or semantically contain the correct answer? Respond only YES or NO.`,
          },
        ],
        temperature: 0,
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      return NextResponse.json({ isCorrect: true, fallback: true });
    }

    const data = await response.json();
    const reply = (data.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
    const isCorrect = reply.startsWith("YES");

    return NextResponse.json({ isCorrect });
  } catch (error) {
    console.error("Answer check error:", error);
    return NextResponse.json({ isCorrect: true, fallback: true });
  }
}
