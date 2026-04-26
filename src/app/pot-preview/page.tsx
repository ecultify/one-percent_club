"use client";

/**
 * /pot-preview
 * Dev playground for PotFill3D. Updated to match the new coin-stack API
 * (previousCoinTotal + newCoinsThisRound). Hit http://localhost:3000/pot-preview
 * while `npm run dev` is running.
 */

import { useRef, useState } from "react";
import PotFill3D from "@/components/PotFill3D";
import CoinTrailToNavbar from "@/components/CoinTrailToNavbar";

const MAX_VISIBLE_COINS = 80;
const MAX_POT = 100 * 100000;
const STAKE_PER_PLAYER = 100000;

const ROUNDS: Array<{ label: string; eliminated: number }> = [
  { label: "Q1 · 90% (~10 eliminated)", eliminated: 10 },
  { label: "Q2 · 80% (~18 eliminated)", eliminated: 18 },
  { label: "Q3 · 60% (~29 eliminated)", eliminated: 29 },
  { label: "Q4 · 50% (~22 eliminated)", eliminated: 22 },
  { label: "Q5 · 30% (~15 eliminated)", eliminated: 15 },
  { label: "Q6 · 10% (~5 eliminated)", eliminated: 5 },
  { label: "Q7 · 1% (~1 eliminated)", eliminated: 1 },
];

function formatRupees(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function PotPreviewPage() {
  const [roundIdx, setRoundIdx] = useState(0);
  const [pot, setPot] = useState(0);
  const [pendingRoundEliminated, setPendingRoundEliminated] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [trailKey, setTrailKey] = useState<number | null>(null);
  const [navbarPot, setNavbarPot] = useState(0);

  const potWrapperRef = useRef<HTMLDivElement | null>(null);

  const previousCoinTotal = Math.round((pot / MAX_POT) * MAX_VISIBLE_COINS);
  const totalAfter = Math.round(((pot + pendingRoundEliminated * STAKE_PER_PLAYER) / MAX_POT) * MAX_VISIBLE_COINS);
  const newCoinsThisRound = Math.max(0, totalAfter - previousCoinTotal);

  const playRound = (eliminated: number) => {
    const added = eliminated * STAKE_PER_PLAYER;
    const newPot = pot + added;
    setPendingRoundEliminated(eliminated);
    setPlayKey((k) => k + 1);

    window.setTimeout(() => {
      setPot(newPot);
      setPendingRoundEliminated(0);
    }, 2000);

    window.setTimeout(() => {
      setTrailKey((k) => (k ?? 0) + 1);
    }, 2200);

    window.setTimeout(() => {
      setNavbarPot(newPot);
    }, 2200 + 1800);
  };

  const reset = () => {
    setPot(0);
    setPendingRoundEliminated(0);
    setNavbarPot(0);
    setRoundIdx(0);
    setTrailKey(null);
    setPlayKey((k) => k + 1);
  };

  const advance = () => {
    if (roundIdx >= ROUNDS.length) return;
    playRound(ROUNDS[roundIdx].eliminated);
    setRoundIdx((i) => i + 1);
  };

  const trailCoinCount = Math.min(20, Math.max(8, Math.floor(pendingRoundEliminated / 5) + 6));

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0805] to-[#1a0f06] text-white">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-gradient-to-b from-[#0a0805ee] to-[#0a080580] border-b border-[#ffd267]/15 px-7 py-3.5 flex items-center justify-between">
        <div className="font-display text-lg text-[#ffd267]">The 1% Club</div>
        <div
          data-tour-id="pot-prize"
          className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#ffd267]/[0.08] border border-[#ffd267]/30"
          style={{ willChange: "transform, filter", transformOrigin: "center" }}
        >
          <div
            className="w-[22px] h-[22px] rounded-full"
            style={{
              background: "radial-gradient(circle at 32% 30%, #fff0b3 0%, #ffd460 38%, #c48a1c 72%, #6e4810 100%)",
              boxShadow: "0 0 8px rgba(255, 200, 80, 0.55)",
            }}
          />
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">Pot</p>
            <p className="font-display text-lg text-[#ffd267] tabular-nums leading-none">{formatRupees(navbarPot)}</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl text-[#ffd267] mb-6">Pot Fill 3D · Preview</h1>
        <div className="rounded-3xl bg-black/45 border-2 border-[#ffd267]/25 p-6 mb-6">
          <div ref={potWrapperRef} className="w-full aspect-square max-w-[460px] mx-auto">
            <PotFill3D
              previousCoinTotal={previousCoinTotal}
              newCoinsThisRound={newCoinsThisRound}
              playKey={playKey}
              durationMs={1500}
              delayMs={300}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
            <button
              onClick={advance}
              disabled={roundIdx >= ROUNDS.length}
              className="w-full mb-3 rounded-lg bg-[#ffd267] text-black font-semibold py-3 text-sm uppercase tracking-[0.18em] disabled:opacity-30"
            >
              {roundIdx >= ROUNDS.length ? "All rounds played" : `Play ${ROUNDS[roundIdx].label.split(" · ")[0]}`}
            </button>
          </div>
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[3, 8, 15, 25].map((n) => (
                <button
                  key={n}
                  onClick={() => playRound(n)}
                  className="rounded-lg bg-white/8 hover:bg-white/15 text-white font-mono text-xs uppercase tracking-[0.18em] py-2 border border-white/15"
                >
                  +{n} elim
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="w-full rounded-lg bg-transparent text-white/70 font-mono text-[10px] uppercase tracking-[0.22em] py-2 border border-white/15"
            >
              Reset pot
            </button>
          </div>
        </div>
      </div>

      <CoinTrailToNavbar
        triggerKey={trailKey}
        sourceRef={potWrapperRef}
        coinCount={trailCoinCount}
      />
    </main>
  );
}
