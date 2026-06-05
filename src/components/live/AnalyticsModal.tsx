"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { METALLIC_RIM_GRADIENT, PANEL_INNER_FILL } from "@/components/QuestionScreen";
import {
  continuedAsViewer,
  eliminationTimeline,
  overview,
  perQuestion,
} from "@/lib/quizAnalytics";
import type { RoomState } from "@/lib/quizProtocol";

/**
 * Host analytics for a single room, presented as a tabbed modal. All data
 * is derived (pure selectors in quizAnalytics.ts) from the live RoomState,
 * so it updates in real time while the modal is open.
 */
interface AnalyticsModalProps {
  state: RoomState;
  onClose: () => void;
}

type Tab = "overview" | "perq" | "elim" | "viewers";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "perq", label: "Per-question" },
  { id: "elim", label: "Eliminations" },
  { id: "viewers", label: "Play-along" },
];

export default function AnalyticsModal({ state, onClose }: AnalyticsModalProps) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl p-[2.5px] shadow-[0_36px_90px_-28px_rgba(0,0,0,0.72)]"
        style={{ background: METALLIC_RIM_GRADIENT }}
      >
        <div className="relative max-h-[85vh] overflow-hidden rounded-[13px]" style={PANEL_INNER_FILL}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-brass/15 px-6 py-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Analytics</p>
              <h2 className="mt-0.5 text-lg font-semibold text-foreground">
                Room stats <span className="font-normal text-foreground/40">· {state.phase}</span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-md border border-brass/30 bg-black/40 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-foreground/70 hover:border-brass/60 hover:text-foreground"
            >
              Close ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-brass/10 px-4 py-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 cursor-pointer rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200 ${
                  tab === t.id ? "bg-brass text-[#14110a]" : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {tab === "overview" && <OverviewTab state={state} />}
            {tab === "perq" && <PerQuestionTab state={state} />}
            {tab === "elim" && <EliminationsTab state={state} />}
            {tab === "viewers" && <PlayAlongTab state={state} />}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ value, label, tone = "brass" }: { value: number | string; label: string; tone?: "brass" | "emerald" | "red" }) {
  const tones = {
    brass: "border-brass/25 bg-brass/5 text-brass-bright",
    emerald: "border-emerald-500/25 bg-emerald-950/30 text-emerald-300",
    red: "border-red-500/25 bg-red-950/30 text-red-300",
  } as const;
  return (
    <div className={`rounded-lg border px-3 py-3 ${tones[tone]}`}>
      <p className="font-mono text-2xl">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-foreground/55">{label}</p>
    </div>
  );
}

function OverviewTab({ state }: { state: RoomState }) {
  const o = overview(state);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard value={o.survivors} label="still in" tone="emerald" />
        <StatCard value={o.scoredTotal} label="players" />
        <StatCard value={`${o.answeredThisQ}/${o.survivors}`} label="answered this Q" />
        <StatCard value={`Q${o.currentQ + 1}/${o.totalQuestions}`} label="current question" />
        <StatCard value={o.unscoredTotal} label="playing along" tone="brass" />
        <StatCard value={o.viewers} label="watching" />
      </div>
    </div>
  );
}

function PerQuestionTab({ state }: { state: RoomState }) {
  const rows = perQuestion(state);
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left font-mono uppercase tracking-[0.2em] text-foreground/40">
          <th className="py-1.5">Q</th>
          <th className="py-1.5">Answered</th>
          <th className="py-1.5">Correct</th>
          <th className="py-1.5">Eliminated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.idx} className="border-t border-brass/10">
            <td className="py-2 font-mono text-brass">Q{r.idx + 1}</td>
            <td className="py-2 text-foreground/80">{r.answered}</td>
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
  if (buckets.length === 0) {
    return <p className="text-sm text-foreground/55">No eliminations yet.</p>;
  }
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
                className="rounded-full border border-red-500/25 bg-red-950/20 px-3 py-1 text-xs text-foreground/80"
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
  if (rows.length === 0) {
    return <p className="text-sm text-foreground/55">Nobody is playing along unscored.</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left font-mono uppercase tracking-[0.2em] text-foreground/40">
          <th className="py-1.5">Name</th>
          <th className="py-1.5">Origin</th>
          <th className="py-1.5">Reached</th>
          <th className="py-1.5">Correct</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-brass/10">
            <td className="py-2 font-medium text-foreground/85">{r.name}</td>
            <td className="py-2 text-foreground/65">
              {r.origin === "continued" ? `out Q${(r.continuedAtQ ?? 0) + 1}, continued` : "viewer"}
            </td>
            <td className="py-2 font-mono text-brass">
              {r.virtualDepth == null ? "—" : `Q${r.virtualDepth + 1}`}
            </td>
            <td className="py-2 text-emerald-300/90">{r.unscoredCorrect}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
