"use client";

import { rankParticipants, scoredParticipants, unscoredParticipants, totalResponseMs } from "@/lib/quizProtocol";
import type { ParticipantState, RoomState } from "@/lib/quizProtocol";
import { continuedAsViewer } from "@/lib/quizAnalytics";

/**
 * End-of-quiz standings, shared by the player view (LiveQuizPlayer) and
 * the spectator /watch page. Only SCORED players appear in the competitive
 * standings; unscored play-along viewers are listed separately. Survivors
 * are the winners; everyone else is ranked by how far they got, then score,
 * then speed.
 */
export default function FinalStandings({ state, myId }: { state: RoomState; myId?: string | null }) {
  const ranked = rankParticipants(scoredParticipants(state.participants));
  const survivors = ranked.filter((p) => !p.eliminated);
  const unscored = unscoredParticipants(state.participants);
  const continued = continuedAsViewer(state);
  const me = myId ? state.participants.find((p) => p.id === myId) ?? null : null;
  const myRank = myId ? ranked.findIndex((p) => p.id === myId) + 1 : 0;

  return (
    <main className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Quiz finished</p>
          <h1 className="mt-2 text-3xl font-semibold">
            {survivors.length > 0
              ? `${survivors.length} survivor${survivors.length === 1 ? "" : "s"}`
              : "Everyone was eliminated"}
          </h1>
          {me && !me.scoring && (
            <p className="mt-3 text-foreground/70">You played along (unscored). Thanks for joining in!</p>
          )}
          {me && me.scoring && (
            <p className="mt-3 text-foreground/70">
              {me.eliminated
                ? `You were eliminated on Q${(me.eliminatedAtQuestion ?? 0) + 1}`
                : "You made it to the end!"}{" "}
              · <span className="font-mono text-brass">{me.score}</span> correct
              {myRank ? ` · rank #${myRank}` : ""}
            </p>
          )}
        </div>

        {survivors.length > 0 && (
          <section className="mt-8 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-5">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-300/80">Survivors</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {survivors.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    p.id === myId
                      ? "border-emerald-300 bg-emerald-500/20 text-emerald-100"
                      : "border-emerald-500/30 bg-emerald-900/30 text-emerald-200"
                  }`}
                >
                  {p.name} · {p.score}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Full standings</h2>
          <ol className="mt-4 space-y-1 text-sm">
            {ranked.slice(0, 50).map((p, i) => (
              <StandingRow key={p.id} p={p} rank={i + 1} highlight={p.id === myId} />
            ))}
          </ol>
        </section>

        {unscored.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">
              Played along <span className="text-sm font-normal text-foreground/45">· unscored</span>
            </h2>
            <ul className="mt-4 space-y-1 text-sm">
              {continued.map((r) => (
                <li
                  key={r.id}
                  className={`flex items-center justify-between gap-3 border-b border-brass/10 py-1.5 last:border-b-0 ${
                    r.id === myId ? "text-brass" : "text-foreground/80"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-foreground/50">
                      {r.origin === "continued" ? `out Q${(r.continuedAtQ ?? 0) + 1}` : "viewer"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4 font-mono text-xs">
                    {r.virtualDepth != null && (
                      <span className="text-foreground/45">reached Q{r.virtualDepth + 1}</span>
                    )}
                    <span className="text-brass">{r.unscoredCorrect}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function StandingRow({ p, rank, highlight }: { p: ParticipantState; rank: number; highlight: boolean }) {
  const seconds = (totalResponseMs(p) / 1000).toFixed(1);
  return (
    <li
      className={`flex items-center justify-between gap-3 border-b border-brass/10 py-1.5 last:border-b-0 ${
        highlight ? "text-brass" : "text-foreground/85"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="w-6 text-right font-mono text-foreground/40">{rank}.</span>
        <span className="truncate">{p.name}</span>
        {p.lateJoin ? (
          <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-foreground/50">
            joined late
          </span>
        ) : p.eliminated ? (
          <span className="shrink-0 rounded-full bg-red-950/40 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-red-300">
            out Q{(p.eliminatedAtQuestion ?? 0) + 1}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300">
            survived
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-4 font-mono text-xs">
        <span className="text-foreground/45">{seconds}s</span>
        <span className="text-brass">{p.score}</span>
      </span>
    </li>
  );
}
