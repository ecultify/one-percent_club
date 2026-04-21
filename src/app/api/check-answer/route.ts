/**
 * POST /api/check-answer
 *
 * Semantic answer grader for The 1% Club questions. Used for the subjective /
 * trick questions where the bare correctIndex check isn't expressive enough.
 *
 * Request body:
 *   {
 *     question: string,          // the prompt shown to the player
 *     correctAnswer: string,     // the canonical correct option (text)
 *     userAnswer: string,        // what the player chose (text of their option)
 *     acceptAny?: boolean        // if true, short-circuit to correct: true
 *   }
 *
 * Response body:
 *   { correct: boolean, rationale: string }
 *
 * Uses fetch against OpenAI's chat completions endpoint directly — no SDK
 * dependency. The key is read from the OPENAI_API_KEY env var (already wired
 * in .env.local).
 */

import { NextResponse } from "next/server";

export const runtime = "edge";

interface CheckBody {
  question?: string;
  correctAnswer?: string;
  userAnswer?: string;
  acceptAny?: boolean;
}

export async function POST(req: Request): Promise<Response> {
  let body: CheckBody;
  try {
    body = (await req.json()) as CheckBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const { question, correctAnswer, userAnswer, acceptAny } = body;

  if (!question || !correctAnswer || !userAnswer) {
    return NextResponse.json(
      { error: "question, correctAnswer, userAnswer are required" },
      { status: 400 },
    );
  }

  // Short-circuit: subjective / trick question — every answer passes.
  if (acceptAny) {
    return NextResponse.json({ correct: true, rationale: "accept-any question" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Graceful fallback — exact-match string comparison if OpenAI isn't
    // configured, so the endpoint stays usable even without a key.
    const correct =
      userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    return NextResponse.json({
      correct,
      rationale: "OPENAI_API_KEY missing — used exact-match fallback",
    });
  }

  const systemPrompt = [
    "You are a quiz-show answer grader. Given a QUESTION, the CANONICAL correct answer,",
    "and the PLAYER's answer, decide whether the player's answer is semantically correct.",
    "Respond with compact JSON: {\"correct\": boolean, \"rationale\": string}.",
    "Be lenient on surface form (case, punctuation, minor wording) but strict on meaning.",
  ].join(" ");

  const userPrompt = `QUESTION: ${question}\nCANONICAL: ${correctAnswer}\nPLAYER: ${userAnswer}\n\nReturn JSON only.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `openai error: ${res.status}`, detail: errText.slice(0, 400) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: { correct?: boolean; rationale?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { correct: false, rationale: "failed to parse model response" };
    }

    return NextResponse.json({
      correct: Boolean(parsed.correct),
      rationale: parsed.rationale ?? "",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "openai fetch failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
