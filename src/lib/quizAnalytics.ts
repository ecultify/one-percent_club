/**
 * Pure selectors that derive host-facing analytics from a RoomState
 * snapshot. No React — easy to test and reuse. Consumed by
 * AnalyticsModal (host dashboard / focused room).
 *
 * Scored vs unscored:
 *   • Scored players drive the competition (score, survival, elimination).
 *   • Unscored "play-along" viewers have their answers recorded but never
 *     counted. Two origins, told apart by eliminatedAtQuestion:
 *       null / -1 → joined as a pure viewer-player (unscored throughout)
 *       >= 0      → a scored player eliminated at that question who opted
 *                   to keep playing unscored.
 */
import {
  scoredParticipants,
  unscoredParticipants,
  type ParticipantState,
  type RoomState,
} from "./quizProtocol";

export interface Overview {
  /** Scored players still in the running. */
  active: number;
  /** Total scored players. */
  scoredTotal: number;
  /** Unscored play-along viewers. */
  unscoredTotal: number;
  /** Pure spectators (never playing). */
  viewers: number;
  /** 0-based current question. */
  currentQ: number;
  totalQuestions: number;
  /** Scored players who have answered the current question. */
  answeredThisQ: number;
  /** Scored survivors (same as `active`, named for the headline). */
  survivors: number;
}

export function overview(s: RoomState): Overview {
  const scored = scoredParticipants(s.participants);
  const idx = s.currentQuestionIdx;
  const active = scored.filter((p) => !p.eliminated).length;
  const answeredThisQ = scored.filter(
    (p) => p.correctness.length > idx && p.correctness[idx] != null,
  ).length;
  return {
    active,
    scoredTotal: scored.length,
    unscoredTotal: unscoredParticipants(s.participants).length,
    viewers: s.viewers.length,
    currentQ: idx,
    totalQuestions: s.totalQuestions,
    answeredThisQ,
    survivors: active,
  };
}

export interface PerQuestionRow {
  /** 0-based question index. */
  idx: number;
  /** Scored players who answered this question. */
  answered: number;
  /** Scored players who answered correctly. */
  correct: number;
  /** Scored players eliminated at this question. */
  eliminated: number;
}

export function perQuestion(s: RoomState): PerQuestionRow[] {
  const scored = scoredParticipants(s.participants);
  const rows: PerQuestionRow[] = [];
  for (let idx = 0; idx < s.totalQuestions; idx++) {
    let answered = 0;
    let correct = 0;
    let eliminated = 0;
    for (const p of scored) {
      if (p.correctness.length > idx && p.correctness[idx] != null) {
        answered += 1;
        if (p.correctness[idx] === true) correct += 1;
      }
      if (p.eliminatedAtQuestion === idx) eliminated += 1;
    }
    rows.push({ idx, answered, correct, eliminated });
  }
  return rows;
}

export interface ElimBucket {
  /** 0-based question index they went out on. */
  idx: number;
  names: string[];
}

/** Scored players grouped by the question they were eliminated at. Skips
 *  survivors (still in) and late-joiners (-1, never really played). */
export function eliminationTimeline(s: RoomState): ElimBucket[] {
  const buckets = new Map<number, string[]>();
  for (const p of scoredParticipants(s.participants)) {
    const at = p.eliminatedAtQuestion;
    if (at == null || at < 0) continue;
    const list = buckets.get(at) ?? [];
    list.push(p.name);
    buckets.set(at, list);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([idx, names]) => ({ idx, names }));
}

export interface ContinuedRow {
  id: string;
  name: string;
  /** "viewer" = joined unscored; "continued" = scored then opted in. */
  origin: "viewer" | "continued";
  /** For "continued", the 0-based question they were scored-eliminated at. */
  continuedAtQ: number | null;
  /** How far they got while unscored: the 0-based index of their first
   *  wrong unscored answer, or the last question they answered if they never
   *  missed. null if they haven't answered any unscored question yet. */
  virtualDepth: number | null;
  /** Count of correct unscored answers. */
  unscoredCorrect: number;
}

/** One row per unscored play-along participant, with how far they got. */
export function continuedAsViewer(s: RoomState): ContinuedRow[] {
  return unscoredParticipants(s.participants).map((p) => buildContinuedRow(p));
}

function buildContinuedRow(p: ParticipantState): ContinuedRow {
  const wasScored = p.eliminatedAtQuestion != null && p.eliminatedAtQuestion >= 0;
  // Unscored answers begin after their scored elimination point (or from Q1
  // for a pure viewer-player).
  const from = wasScored ? (p.eliminatedAtQuestion as number) + 1 : 0;

  let unscoredCorrect = 0;
  let firstWrong: number | null = null;
  let lastAnswered: number | null = null;
  for (let i = from; i < p.correctness.length; i++) {
    const c = p.correctness[i];
    if (c == null) continue;
    lastAnswered = i;
    if (c === true) unscoredCorrect += 1;
    else if (firstWrong == null) firstWrong = i;
  }

  return {
    id: p.id,
    name: p.name,
    origin: wasScored ? "continued" : "viewer",
    continuedAtQ: wasScored ? (p.eliminatedAtQuestion as number) : null,
    virtualDepth: firstWrong ?? lastAnswered,
    unscoredCorrect,
  };
}
