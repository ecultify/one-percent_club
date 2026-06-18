"use client";

/**
 * ⚠️ DEVELOPMENTAL — TESTING ONLY. Remove before / after the test window.
 * ───────────────────────────────────────────────────────────────────────
 * Harness to click through EVERY question in all three live sets (A / B / C)
 * in the real QuestionScreen UI, WITHOUT a PartyKit host, a server, or
 * multiple clients.
 *
 * Renders the QuestionScreen NATURALLY at the full viewport — use the
 * browser's responsive / device-mode to preview the mobile layout (the
 * component's breakpoints respond to the real viewport width).
 *
 * Reachable only at /dev/sets and only in development (`next dev`); a
 * production build 404s it (NODE_ENV guard below).
 *
 * TO REMOVE WHEN TESTING IS DONE: delete the entire `src/app/dev/` folder.
 * Nothing else imports it.
 */

import { useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import QuestionScreen from "@/components/QuestionScreen";
import { getQuestionSet } from "@/components/live/questionSets";
import { QUESTION_SET_IDS, SET_LABELS, type QuestionSetId } from "@/lib/questionSetMeta";
import type { Question } from "@/components/QuizGame";

/** Local, instant correctness check (no OpenAI round-trip). */
function gradeLocally(q: Question, selectedIndex: number, typed?: string): boolean {
  if (q.acceptAny) return true;
  if (q.textInput) {
    const raw = (typed ?? "").trim().toLowerCase();
    if (q.passRegex) {
      try {
        return new RegExp(q.passRegex, "i").test(raw);
      } catch {
        return false;
      }
    }
    return raw.length > 0;
  }
  if (q.numberInput) {
    const n = parseInt((typed ?? "").trim(), 10);
    return !Number.isNaN(n) && n === q.correctNumber;
  }
  return selectedIndex === q.correctIndex;
}

export default function DevSetsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [setId, setSetId] = useState<QuestionSetId>("A");
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [paused, setPaused] = useState(false);
  const [liveChrome, setLiveChrome] = useState(true);
  /** Collapse the control bar so it never covers the screen while inspecting. */
  const [barOpen, setBarOpen] = useState(true);

  const questions = useMemo(() => getQuestionSet(setId), [setId]);
  const total = questions.length;
  const q = questions[idx];

  useEffect(() => {
    setAnswered(false);
    setSelected(null);
    setIsCorrect(false);
  }, [setId, idx]);

  const go = (delta: number) => setIdx((i) => Math.min(total - 1, Math.max(0, i + delta)));

  const btn = (active: boolean) =>
    `rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
      active ? "bg-amber-400 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"
    }`;

  if (!q) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white/70">
        No question at {SET_LABELS[setId]} #{idx + 1}
      </main>
    );
  }

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      {/* ── DEV CONTROL BAR — fixed, slim, high z, collapsible so it never
            obscures the screen you're inspecting. ── */}
      {barOpen ? (
        <div className="fixed inset-x-0 top-0 z-[200] flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-400/40 bg-black/90 px-3 py-1.5 backdrop-blur">
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300">
            DEV · sets
          </span>

          {/* Set switcher */}
          <div className="flex items-center gap-1">
            {QUESTION_SET_IDS.map((s) => (
              <button key={s} type="button" onClick={() => { setSetId(s); setIdx(0); }} className={btn(s === setId)}>
                {SET_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Question nav */}
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => go(-1)} disabled={idx === 0} className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/80 hover:bg-white/20 disabled:opacity-30">‹</button>
            <span className="min-w-[78px] text-center font-mono text-[11px] text-white/80">Q{idx + 1}/{total} · {q.percentage}%</span>
            <button type="button" onClick={() => go(1)} disabled={idx === total - 1} className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/80 hover:bg-white/20 disabled:opacity-30">›</button>
          </div>

          {/* State toggles */}
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { setSelected(null); setIsCorrect(false); setAnswered(true); }} className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/80 hover:bg-white/20">Reveal</button>
            <button type="button" onClick={() => { setAnswered(false); setSelected(null); setIsCorrect(false); }} className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/80 hover:bg-white/20">Reset</button>
            <button type="button" onClick={() => setPaused((p) => !p)} className={btn(paused)}>{paused ? "Narrating" : "Live clock"}</button>
            <button type="button" onClick={() => setLiveChrome((c) => !c)} className={btn(liveChrome)}>{liveChrome ? "Live UI" : "Solo UI"}</button>
          </div>

          <button type="button" onClick={() => setBarOpen(false)} className="ml-auto rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/60 hover:bg-white/20" title="Hide bar">✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setBarOpen(true)}
          className="fixed right-2 top-2 z-[200] rounded bg-amber-500/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200 backdrop-blur hover:bg-amber-500/50"
        >
          DEV
        </button>
      )}

      {/* The real screen at full viewport — keyed so it fully remounts per question. */}
      <QuestionScreen
        key={`${setId}-${idx}`}
        question={q}
        questionNumber={idx + 1}
        totalQuestions={total}
        potPrize={0}
        remainingPlayers={1}
        totalPlayers={1}
        playerName="Tester"
        onAnswer={(index, typed) => {
          setSelected(index);
          setIsCorrect(gradeLocally(q, index, typed));
          setAnswered(true);
        }}
        onTimeUp={() => {
          setSelected(null);
          setIsCorrect(false);
          setAnswered(true);
        }}
        answered={answered}
        revealed={answered}
        selectedAnswer={selected}
        isCorrect={isCorrect}
        paused={paused}
        answerHintChip={liveChrome}
      />
    </main>
  );
}
