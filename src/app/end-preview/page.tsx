"use client";

/**
 * /end-preview
 * Direct preview of the FinalResult / FinalStage3D end screen — bypasses
 * the welcome video, instructions, and the eight rounds of gameplay.
 *
 * Usage: http://localhost:3000/end-preview
 *
 * Query params:
 *   ?winner=1  — preview the winner state (default: winner=1)
 *   ?winner=0  — preview the loser state (knocked out at some %)
 *   ?reached=10 — what % they reached (only relevant when winner=0)
 */

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import QuizGame from "@/components/QuizGame";

function EndPreviewInner() {
  const params = useSearchParams();
  const winnerParam = params.get("winner");
  const winner = winnerParam == null ? true : winnerParam === "1";
  const reached = Number(params.get("reached") ?? "10");

  // The champion preview path inside QuizGame already builds the perfect
  // end-state (all 8 correct, full pot, phase=final-result). For a loser
  // preview, we'd need a different seed — flagged as a follow-up.
  const key = useMemo(() => `end-preview-${winner ? "win" : "lose"}-${reached}`, [winner, reached]);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#0a0908]">
      <QuizGame
        key={key}
        playerName="Champion (preview)"
        devChampionPreview={true}
        onBackToMenu={() => {
          // No-op in preview — refresh the page to reset.
          window.location.reload();
        }}
      />
    </main>
  );
}

export default function EndPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0908]" />}>
      <EndPreviewInner />
    </Suspense>
  );
}
