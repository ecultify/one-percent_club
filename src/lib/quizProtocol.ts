/**
 * Wire protocol shared between the PartyKit server (party/quiz.ts) and
 * the React clients (host / play / watch pages). Both sides import these
 * types so the message shape stays in sync.
 *
 * Live-quiz model (synchronized "1% Club"-style elimination):
 * ─────────────────────────────────────────────────────────
 *   • Room phase: lobby → running → ended. Driven by the host's
 *     "start" / "end" actions.
 *   • While running, the SERVER drives one shared question for
 *     everyone (currentQuestionIdx) and a per-question sub-phase
 *     (roundPhase: "asking" → "revealing"). Every player and viewer
 *     sees the same question at the same time and advances together.
 *   • Each player answers at their own speed within the shared clock.
 *     A wrong answer (or running out the clock) ELIMINATES the player
 *     for the rest of the quiz — they flip to a spectator view.
 *     Players who answer correctly survive to the next round. The
 *     response time is recorded per question so faster correct answers
 *     can break ties.
 *   • The client computes its own answer correctness (matching the
 *     solo flow's checks, including OpenAI for text questions) and
 *     reports the verdict + elapsed time via "report-answer". The
 *     server is authoritative for the clock, elimination and tallies
 *     but trusts the client's grading.
 *   • Question CONTENT is still NOT on the wire — clients resolve the
 *     room's question set (A/B/C, picked by the host at room creation)
 *     from src/components/live/questionSets.ts via state.questionSet.
 */

import type { QuestionSetId } from "./questionSetMeta";

export type { QuestionSetId };

export type RoomPhase = "lobby" | "running" | "ended";

/** Sub-phase of the current question while the room is "running".
 *  "narrating" — the question's voice-over is playing for the whole
 *                room at once; the clock is frozen and answers are not
 *                accepted yet.
 *  "asking"    — the VO has finished, the clock is live; players may
 *                submit answers.
 *  "revealing" — the clock is up; the correct answer is shown and any
 *                player who answered wrong / didn't answer is now out.
 *                In automatic flow it lasts a short hold before the server
 *                advances; in manual-control mode it is parked indefinitely
 *                (the whole room sits on the answer reveal) until the host
 *                sends "next-question". */
export type RoundPhase = "narrating" | "asking" | "revealing";

export interface ParticipantState {
  /** Stable PartyKit connection id. */
  id: string;
  name: string;
  /** Cumulative correct-answer count. */
  score: number;
  /** Per-question answer log. answers[i] is the answer they gave for
   *  Q<i+1>, or null if they didn't answer that question. */
  answers: (number | string | null)[];
  /** Per-question correctness log. Parallel to answers. */
  correctness: (boolean | null)[];
  /** Per-question response time in ms, measured from when that
   *  question's clock started. null if they didn't answer. Parallel
   *  to answers. */
  times: (number | null)[];
  /** True once this player has answered wrong or timed out — they are
   *  out of the running and only spectate from here on. */
  eliminated: boolean;
  /** 0-based question index at which they were eliminated, or null if
   *  they are still in (a survivor). */
  eliminatedAtQuestion: number | null;
  /** True if they joined after the quiz had already started — they
   *  never got to play and spectate immediately. */
  lateJoin: boolean;
  /** Whether this player's answers count. true = a normal scored player
   *  (counts toward score, survival, elimination and round-gating).
   *  false = an unscored "play-along" viewer: their answers are recorded
   *  for analytics but never scored, never eliminate them, and never gate
   *  the round. Two origins, distinguished via eliminatedAtQuestion:
   *    null / -1 → joined as a pure viewer-player (unscored from the start)
   *    >= 0      → was a scored player eliminated at that question who then
   *                opted to keep playing unscored. */
  scoring: boolean;
  /** True once the player has spent their one skip-a-question lifeline
   *  (unlocked from the 50% question onward). Optional so snapshots
   *  persisted before the field existed still rehydrate. */
  lifelineUsed?: boolean;
}

export interface ViewerState {
  id: string;
  name?: string;
}

export interface RoomState {
  phase: RoomPhase;
  hostId: string | null;
  participants: ParticipantState[];
  viewers: ViewerState[];
  /** Server-side ms when the host hit "start". null in lobby. */
  startedAt: number | null;
  /** Which question set (A/B/C) this room plays. Set by the host at room
   *  creation (carried on host-claim) and fixed for the room's life; the
   *  clients resolve the actual question content from this id. */
  questionSet: QuestionSetId;
  /** "Read out" mode: each round opens in "narrating" with the clock
   *  frozen (no recorded VO plays) while the host reads the question
   *  aloud, and stays there until the host sends "open-clock". Set in the
   *  lobby via "set-narration-options"; LOCKED once the quiz starts. */
  hostNarration: boolean;
  /** Mute recorded VOs for the whole game: rounds follow normal server
   *  timing but no "narrating" hold happens and no VO plays. Set in the
   *  lobby via "set-narration-options"; LOCKED once the quiz starts.
   *  Ignored while hostNarration is on (no VO plays in that mode anyway). */
  muteVo: boolean;
  /** Host-driven question flow: when true, every round holds (clock frozen)
   *  until the host presses "Start question" (open-clock), and the host can
   *  press "End question" (end-question) to reveal before the clock expires.
   *  When false the server runs rounds automatically. Toggleable anytime via
   *  "set-room-control". */
  manualControl: boolean;
  /** Master mute set by the host: silences BOTH recorded VO and the game-show
   *  audio for EVERYONE, except ids listed in `unmutedIds`. Toggleable anytime
   *  via "set-room-control". Distinct from `muteVo` (lobby-only, VO-only). */
  mutedAll: boolean;
  /** Connection ids exempted from `mutedAll` — the host can re-enable sound for
   *  specific people (e.g. a co-host or the room's speakers). */
  unmutedIds: string[];
  /** Whether joining players see the multi-page instructions screen in the
   *  pre-game intro. Host-toggleable via "set-room-control"; defaults true. */
  showInstructions: boolean;
  /** Question count for this room's set. */
  totalQuestions: number;
  /** Global 0-based question everyone is on. Server-driven while
   *  running; 0 in the lobby. */
  currentQuestionIdx: number;
  /** Sub-phase of the current question. Only meaningful while running. */
  roundPhase: RoundPhase;
  /** Server ms when the current question's clock started. Lets late
   *  joiners / reconnecting clients sync the countdown. null when not
   *  actively asking. */
  questionStartedAt: number | null;
  /** Server ms when the game ended (host "end" or the final reveal). null
   *  until the game is over. The /play + /watch links stay usable for
   *  ROOM_EXPIRY_MS after this, then expire. Cleared on start / reset. */
  endedAt: number | null;
}

// ─── Client → Server messages ────────────────────────────────────────────

export interface HostClaimMessage {
  type: "host-claim";
  hostKey: string;
  /** Which question set this room should play. Adopted by the server only
   *  while the room is still in the lobby (a set never changes mid-game).
   *  Omitted → the server keeps its current (or default) set. */
  questionSet?: QuestionSetId;
}

export interface StartQuizMessage {
  type: "start";
}

export interface EndQuizMessage {
  type: "end";
}

export interface ResetRoomMessage {
  type: "reset";
}

export interface KickMessage {
  type: "kick";
  participantId: string;
}

export interface JoinParticipantMessage {
  type: "join-participant";
  name: string;
  /** When false, join as an unscored play-along viewer (answers recorded
   *  for analytics but never scored). Defaults to true (normal player). */
  scoring?: boolean;
}

/** Sent by an eliminated participant who chooses "Play as viewer" — they
 *  keep playing the rest of the quiz unscored. The server sets their
 *  scoring flag to false (retaining their elimination point) so their
 *  subsequent answers are recorded but never counted. */
export interface ContinueAsViewerMessage {
  type: "continue-as-viewer";
}

/** Sent by the participant when they answer on a question. The client
 *  computes correctness from its own copy of QUESTIONS and reports the
 *  verdict + how long they took — the server trusts the grade, records
 *  the time, and eliminates the player if the answer was wrong.
 *  `questionIdx` must equal the room's currentQuestionIdx or the report
 *  is rejected (the round has already moved on). */
export interface ReportAnswerMessage {
  type: "report-answer";
  questionIdx: number;
  answer: number | string | null;
  correct: boolean;
  /** Ms the player took to answer, measured from when this question's
   *  clock started on their client. */
  elapsedMs: number;
}

/** Sent by a live scored player spending their one skip-a-question
 *  lifeline (unlocked from the 50% question onward). The server marks the
 *  round as passed for them — no score, no elimination — and flags the
 *  lifeline as spent. Rejected if already used, the player is out/unscored,
 *  or the round isn't currently asking. */
export interface UseLifelineMessage {
  type: "use-lifeline";
  questionIdx: number;
}

export interface JoinViewerMessage {
  type: "join-viewer";
  name?: string;
}

/** Host-only, LOBBY-ONLY: configure narration for the upcoming game.
 *  Rejected with error "narration-locked" once the quiz has started.
 *  Omitted fields keep their current value. */
export interface SetNarrationOptionsMessage {
  type: "set-narration-options";
  /** "Read out" — host reads each question and starts the clock manually. */
  hostNarration?: boolean;
  /** Mute recorded VOs for the whole game (server timing unchanged). */
  muteVo?: boolean;
}

/** Host-only: while a round is holding in "narrating" (host-narration or
 *  manual-control mode), start the shared answer clock for everyone. */
export interface OpenClockMessage {
  type: "open-clock";
}

/** Host-only: force the current question to reveal NOW (before the clock
 *  expires). Only valid in manual-control mode while roundPhase is "asking". */
export interface EndQuestionMessage {
  type: "end-question";
}

/** Host-only: advance from the held answer reveal to the next question. Only
 *  meaningful in manual-control mode while roundPhase is "revealing" — in
 *  manual mode the reveal is parked indefinitely (the whole room sits on the
 *  answer-reveal screen) until the host sends this. */
export interface NextQuestionMessage {
  type: "next-question";
}

/** Host-only, anytime: live room controls that are NOT lobby-locked.
 *  Omitted fields keep their current value. */
export interface SetRoomControlMessage {
  type: "set-room-control";
  /** Manual question start/end flow. */
  manualControl?: boolean;
  /** Master mute (VO + game-show audio) for everyone. */
  mutedAll?: boolean;
  /** Show the instructions screen to joining players. */
  showInstructions?: boolean;
}

/** Host-only: exempt (or re-include) one connection from the master mute.
 *  muted=false → unmute this user (add to unmutedIds); muted=true → fold them
 *  back under the master mute (remove from unmutedIds). */
export interface SetUserMutedMessage {
  type: "set-user-muted";
  participantId: string;
  muted: boolean;
}

export type ClientMessage =
  | HostClaimMessage
  | StartQuizMessage
  | EndQuizMessage
  | ResetRoomMessage
  | KickMessage
  | JoinParticipantMessage
  | ReportAnswerMessage
  | UseLifelineMessage
  | JoinViewerMessage
  | ContinueAsViewerMessage
  | SetNarrationOptionsMessage
  | OpenClockMessage
  | EndQuestionMessage
  | NextQuestionMessage
  | SetRoomControlMessage
  | SetUserMutedMessage;

// ─── Server → Client messages ────────────────────────────────────────────

export interface StateUpdateMessage {
  type: "state";
  state: RoomState;
}

/** Sent only to the connection that just sent join-participant /
 *  host-claim — lets the client know its own connection id so it can
 *  identify itself in the participants list. */
export interface IdentityMessage {
  type: "identity";
  id: string;
  role: "host" | "participant" | "viewer";
}

export interface ErrorMessage {
  type: "error";
  reason: string;
}

export interface KickedMessage {
  type: "kicked";
}

export type ServerMessage =
  | StateUpdateMessage
  | IdentityMessage
  | ErrorMessage
  | KickedMessage;

/** Whether the host's master mute applies to THIS connection — true when
 *  mutedAll is on and this id isn't on the unmuted exemption list. Clients use
 *  it to silence both recorded VO and the game-show bed. */
export function isMutedFor(state: Pick<RoomState, "mutedAll" | "unmutedIds">, myId: string | null): boolean {
  return state.mutedAll && !(myId != null && state.unmutedIds.includes(myId));
}

// ─── Post-game link expiry ────────────────────────────────────────────────

/** How long the /play + /watch links stay usable after a game ends. Players
 *  get exactly this window to view the final scores; after it the link is
 *  inaccessible (server rejects new joins; clients show an "expired" screen).
 *  Shared by the PartyKit server (enforcement) and the client (live gate). */
export const ROOM_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/** True once a room has been in the "ended" phase for longer than
 *  ROOM_EXPIRY_MS. `now` is passed in so callers can drive it off a live
 *  clock / timer without this module reading Date.now() itself. */
export function isRoomExpired(state: Pick<RoomState, "phase" | "endedAt">, now: number): boolean {
  return state.phase === "ended" && state.endedAt != null && now - state.endedAt >= ROOM_EXPIRY_MS;
}

// ─── Shared ranking helpers (client-side display) ─────────────────────────

/** Scored players only (their answers count toward the standings). */
export function scoredParticipants(participants: ParticipantState[]): ParticipantState[] {
  return participants.filter((p) => p.scoring);
}

/** Unscored "play-along" viewers — recorded for analytics, excluded from
 *  the competitive standings. */
export function unscoredParticipants(participants: ParticipantState[]): ParticipantState[] {
  return participants.filter((p) => !p.scoring);
}

/** Every player who joins the lobby stakes this much; the stake stacks onto
 *  the pot prize when they're eliminated. ₹1 lakh × 100 players = ₹1 crore. */
export const POT_STAKE_PER_PLAYER = 100_000;

/** Accumulated pot prize: ₹1 lakh for every player eliminated as a scored
 *  player. `eliminatedAtQuestion >= 0` marks a genuine in-game elimination —
 *  it stays set even if that player later opts to keep playing unscored, so
 *  their stake remains in the pot. Survivors (null) and late joiners / pure
 *  viewer-players (-1) never staked, so they don't count. */
export function potPrizeFromParticipants(participants: ParticipantState[]): number {
  const eliminated = participants.filter(
    (p) => p.eliminatedAtQuestion != null && p.eliminatedAtQuestion >= 0,
  ).length;
  return eliminated * POT_STAKE_PER_PLAYER;
}

/** Total correct-answer response time for a participant, in ms. Used as
 *  the final tiebreak — fewer ms (faster) ranks higher. */
export function totalResponseMs(p: ParticipantState): number {
  return p.times.reduce<number>((sum, t) => sum + (t ?? 0), 0);
}

/** Rank participants for a leaderboard / standings view:
 *    1. Survivors (still in) ahead of eliminated players.
 *    2. Among the eliminated, whoever lasted to a later question ranks
 *       higher.
 *    3. Then by score (more correct answers first).
 *    4. Then by total response time (faster first). */
export function rankParticipants(participants: ParticipantState[]): ParticipantState[] {
  return [...participants].sort((a, b) => {
    const aSurvived = a.eliminated ? 0 : 1;
    const bSurvived = b.eliminated ? 0 : 1;
    if (aSurvived !== bSurvived) return bSurvived - aSurvived;
    const aElim = a.eliminatedAtQuestion ?? Number.MAX_SAFE_INTEGER;
    const bElim = b.eliminatedAtQuestion ?? Number.MAX_SAFE_INTEGER;
    if (aElim !== bElim) return bElim - aElim;
    if (b.score !== a.score) return b.score - a.score;
    return totalResponseMs(a) - totalResponseMs(b);
  });
}
