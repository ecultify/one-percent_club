"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { QUESTIONS } from "@/components/QuizGame";

/**
 * Participant view of a live quiz room. Connects to the same PartyKit
 * room as the host, joins via `join-participant`, then renders the
 * current-question view based on the server-broadcast state. Answers
 * are sent via `submit-answer` and locked locally until the next
 * question advances the state.
 */
export default function PlayRoomPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const roomCode = (params?.code ?? "").toUpperCase();
  const name = search?.get("name") ?? "";

  const { state, send, error, kicked, connected } = usePartyRoom(roomCode);

  const [joined, setJoined] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<number | string | null>(null);
  const [submittedForQ, setSubmittedForQ] = useState<number | null>(null);
  const [textInput, setTextInput] = useState("");

  // Send the join message once after the socket connects.
  useEffect(() => {
    if (!connected || joined) return;
    send({ type: "join-participant", name: name || "Player" });
    setJoined(true);
  }, [connected, joined, name, send]);

  // Clear the locally-locked answer once the server advances to the next question.
  useEffect(() => {
    if (!state) return;
    if (submittedForQ != null && state.currentQuestionIdx !== submittedForQ) {
      setSubmittedAnswer(null);
      setSubmittedForQ(null);
      setTextInput("");
    }
  }, [state, submittedForQ]);

  const currentQ = useMemo(() => {
    if (!state) return null;
    return QUESTIONS[state.currentQuestionIdx] ?? null;
  }, [state]);

  const me = useMemo(() => {
    if (!state) return null;
    // PartyKit assigns the same connection id across reconnects on the same
    // socket, so the server can identify us by it. The client doesn't know
    // its own id directly — we identify ourselves by name instead.
    return state.participants.find((p) => p.name === (name || "Player")) ?? null;
  }, [state, name]);

  if (kicked) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-black text-foreground/80 px-6 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-red-300/70">Removed</p>
        <h1 className="mt-2 text-2xl font-semibold">You were removed from this room</h1>
        <p className="mt-2 text-sm text-foreground/55">The host has removed you from this quiz.</p>
      </main>
    );
  }

  if (!connected || !state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Connecting to room <span className="ml-2 font-mono">{roomCode}</span>…
      </main>
    );
  }

  const submit = (answer: number | string) => {
    if (submittedAnswer != null) return;
    send({ type: "submit-answer", answer });
    setSubmittedAnswer(answer);
    setSubmittedForQ(state.currentQuestionIdx);
  };

  const renderBody = () => {
    if (state.phase === "lobby") {
      return (
        <div className="text-center space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Waiting for host</p>
          <h1 className="text-2xl font-semibold">You&apos;re in. Sit tight.</h1>
          <p className="text-sm text-foreground/55">
            The host will start the quiz in a moment. Other players joining:{" "}
            <span className="font-mono text-foreground/80">{state.participants.length}</span>
          </p>
        </div>
      );
    }
    if (state.phase === "ended") {
      const sorted = [...state.participants].sort((a, b) => b.score - a.score);
      const myRank = me ? sorted.findIndex((p) => p.id === me.id) + 1 : null;
      return (
        <div className="space-y-4 text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Finished</p>
          <h1 className="text-3xl font-semibold">Quiz over</h1>
          {me && (
            <p className="text-foreground/70">
              You scored <span className="font-mono text-brass">{me.score}</span> / {state.totalQuestions}
              {myRank ? ` · rank #${myRank}` : ""}
            </p>
          )}
          <ol className="mt-4 space-y-1 text-sm">
            {sorted.slice(0, 10).map((p, i) => (
              <li key={p.id} className="flex justify-between border-b border-brass/10 py-1">
                <span><span className="mr-2 font-mono text-foreground/40">{i + 1}.</span>{p.name}</span>
                <span className="font-mono text-brass">{p.score}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    if (!currentQ) {
      return <p className="text-foreground/60">Waiting for question…</p>;
    }

    const locked = submittedAnswer != null && submittedForQ === state.currentQuestionIdx;
    const reveal = state.phase === "reveal";

    return (
      <div className="space-y-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">
            Q{state.currentQuestionIdx + 1} / {state.totalQuestions}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{currentQ.question}</h1>
          {currentQ.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentQ.image} alt="" className="mt-4 mx-auto max-h-64 rounded-md border border-brass/20" />
          )}
        </div>

        {currentQ.textInput || currentQ.numberInput ? (
          <div className="space-y-2">
            <input
              value={typeof submittedAnswer === "string" ? submittedAnswer : textInput}
              onChange={(e) => setTextInput(currentQ.numberInput ? e.target.value.replace(/[^0-9]/g, "").slice(0, currentQ.maxDigits ?? 6) : e.target.value)}
              disabled={locked || reveal}
              inputMode={currentQ.numberInput ? "numeric" : "text"}
              placeholder={currentQ.numberInput ? "Type a number" : "Type your answer"}
              className="w-full rounded-md border border-brass/25 bg-black/60 px-4 py-3 text-lg text-foreground placeholder:text-foreground/30 focus:border-brass focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => submit(currentQ.numberInput ? Number(textInput) : textInput)}
              disabled={locked || reveal || !textInput.trim()}
              className="w-full rounded-lg bg-brass px-5 py-3 text-sm font-medium uppercase tracking-[0.2em] text-black hover:bg-brass/85 disabled:cursor-not-allowed disabled:bg-brass/25 disabled:text-foreground/40"
            >
              {locked ? "Locked in" : "Submit"}
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {currentQ.options.map((opt, i) => {
              const isMine = submittedAnswer === i;
              const isCorrect = reveal && i === currentQ.correctIndex;
              const isMineWrong = reveal && isMine && i !== currentQ.correctIndex;
              return (
                <li key={i}>
                  <button
                    onClick={() => submit(i)}
                    disabled={locked || reveal}
                    className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                      isCorrect
                        ? "border-emerald-500/60 bg-emerald-900/30"
                        : isMineWrong
                          ? "border-red-500/60 bg-red-900/30"
                          : isMine
                            ? "border-brass bg-brass/15"
                            : "border-brass/20 bg-black/40 hover:border-brass/40"
                    } disabled:cursor-not-allowed`}
                  >
                    <span className="mr-2 font-mono text-foreground/50">{"ABCD"[i]}.</span>
                    {opt}
                    {isCorrect && <span className="ml-2 text-emerald-300">✓</span>}
                    {isMineWrong && <span className="ml-2 text-red-300">✗</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {reveal && (
          <p className="text-center text-sm text-foreground/65">
            Waiting for host to advance to the next question…
          </p>
        )}
        {state.phase === "question" && locked && (
          <p className="text-center text-sm text-foreground/65">Locked in. Waiting for the host to reveal.</p>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between text-xs font-mono text-foreground/55">
          <span>Room <span className="text-brass">{roomCode}</span></span>
          <span>{me ? `${me.name} · ${me.score} pts` : name || "Connecting…"}</span>
        </div>
        {error === "answers-closed" && (
          <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-950/30 px-3 py-2 text-xs text-yellow-200">
            Too late — the host has already locked answers for this question.
          </div>
        )}
        {renderBody()}
      </div>
    </main>
  );
}
