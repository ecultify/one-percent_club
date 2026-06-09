"use client";

import { useState } from "react";
import { continuedAsViewer, eliminationTimeline, overview, perQuestion } from "@/lib/quizAnalytics";
import type { RoomState } from "@/lib/quizProtocol";

/**
 * Inline live analytics for a room (shown directly on the host lobby page).
 * All data is derived from the live RoomState via pure selectors, so it
 * updates in real time. Black/white, tabbed.
 */
type Tab = "overview" | "perq" | "elim" | "viewers";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "perq", label: "Per-question" },
  { id: "elim", label: "Eliminations" },
  { id: "viewers", label: "Play-along" },
];

export default function AnalyticsPanel({ state }: { state: RoomState }) {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <section className="rounded-xl border border-white/10 bg-neutral-950 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Live stats</h2>
        <div className="inline-flex gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 ${
                tab === t.id ? "bg-white/15 text-white" : "text-white/45 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5">
        {tab === "overview" && <OverviewTab state={state} />}
        {tab === "perq" && <PerQuestionTab state={state} />}
        {tab === "elim" && <EliminationsTab state={state} />}
        {tab === "viewers" && <PlayAlongTab state={state} />}
      </div>
    </section>
  );
}

function StatCard({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: "neutral" | "emerald" | "red";
}) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-white",
    emerald: "border-emerald-500/25 bg-emerald-950/30 text-emerald-300",
    red: "border-red-500/25 bg-red-950/30 text-red-300",
  } as const;
  return (
    <div className={`rounded-lg border px-3 py-3 ${tones[tone]}`}>
      <p className="font-mono text-2xl">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/55">{label}</p>
    </div>
  );
}

function OverviewTab({ state }: { state: RoomState }) {
  const o = overview(state);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard value={o.survivors} label="still in" tone="emerald" />
      <StatCard value={o.scoredTotal} label="players" />
      <StatCard value={`${o.answeredThisQ}/${o.survivors}`} label="answered this Q" />
      <StatCard value={`Q${o.currentQ + 1}/${o.totalQuestions}`} label="current question" />
      <StatCard value={o.unscoredTotal} label="playing along" />
      <StatCard value={o.viewers} label="watching" />
    </div>
  );
}

function PerQuestionTab({ state }: { state: RoomState }) {
  const rows = perQuestion(state);
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left font-mono uppercase tracking-[0.2em] text-white/40">
          <th className="py-1.5">Q</th>
          <th className="py-1.5">Answered</th>
          <th className="py-1.5">Correct</th>
          <th className="py-1.5">Eliminated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.idx} className="border-t border-white/10">
            <td className="py-2 font-mono text-white">Q{r.idx + 1}</td>
            <td className="py-2 text-white/80">{r.answered}</td>
            <td className="py-2 text-emerald-300/90">{r.correct}</td>
            <td className="py-2 text-red-300/80">{r.eliminated}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EliminationsTab({ state }: { state: RoomState }) {
  const buckets = eliminationTimeline(state);
  if (buckets.length === 0) return <p className="text-sm text-white/55">No eliminations yet.</p>;
  return (
    <div className="space-y-4">
      {buckets.map((b) => (
        <div key={b.idx}>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-300/80">
            Q{b.idx + 1} · {b.names.length} out
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {b.names.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className="rounded-full border border-red-500/25 bg-red-950/20 px-3 py-1 text-xs text-white/80"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayAlongTab({ state }: { state: RoomState }) {
  const rows = continuedAsViewer(state);
  if (rows.length === 0) return <p className="text-sm text-white/55">Nobody is playing along unscored.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left font-mono uppercase tracking-[0.2em] text-white/40">
          <th className="py-1.5">Name</th>
          <th className="py-1.5">Origin</th>
          <th className="py-1.5">Reached</th>
          <th className="py-1.5">Correct</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/10">
            <td className="py-2 font-medium text-white">{r.name}</td>
            <td className="py-2 text-white/65">
              {r.origin === "continued" ? `out Q${(r.continuedAtQ ?? 0) + 1}, continued` : "viewer"}
            </td>
            <td className="py-2 font-mono text-white">{r.virtualDepth == null ? "—" : `Q${r.virtualDepth + 1}`}</td>
            <td className="py-2 text-emerald-300/90">{r.unscoredCorrect}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
