/**
 * Wire protocol shared between the PartyKit server (party/quiz.ts) and
 * the React clients (host / play / watch pages). Both sides import these
 * types so the message shape stays in sync. The server holds the
 * authoritative state; clients render from it and send action messages
 * back.
 *
 * Question CONTENT (text, options, images) is NOT carried on the wire —
 * clients import the same `QUESTIONS` array from `src/components/QuizGame`
 * and look up by `currentQuestionIdx`. The server only tracks indices,
 * scoring and phase.
 */

/** High-level room phase. The host drives this; clients render against it. */
export type RoomPhase = "lobby" | "question" | "reveal" | "ended";

/** Per-participant scoreboard entry. Eliminated participants stay in the
 *  list (their score freezes) so they can still see results live. */
export interface ParticipantState {
  /** Stable connection id assigned by PartyKit. */
  id: string;
  /** Display name entered at join time. */
  name: string;
  /** Cumulative correct-answer count. */
  score: number;
  /** Per-question answers recorded for review. Index 0 = Q1, etc. */
  answers: (number | string | null)[];
  /** Set true the first time the participant gets a question wrong; their
   *  future answers no longer count toward the score. */
  eliminated: boolean;
  /** True iff the participant has submitted an answer for the current
   *  question (used by the host UI to gauge progress without revealing
   *  the answer itself). */
  hasAnsweredThisRound: boolean;
}

/** Lightweight viewer record — viewers don't answer. */
export interface ViewerState {
  id: string;
  name?: string;
}

/** Full room snapshot broadcast by the server on every state change. */
export interface RoomState {
  phase: RoomPhase;
  /** Zero-based index into the shared QUESTIONS array. */
  currentQuestionIdx: number;
  /** Connection id of the host, or null if no host has claimed yet. */
  hostId: string | null;
  participants: ParticipantState[];
  viewers: ViewerState[];
  /** Set to the correct index/text when phase === "reveal", null otherwise. */
  revealedCorrectIndex: number | null;
  revealedCorrectText: string | null;
  /** Server-side wall-clock ms when the current question entered "question"
   *  phase. Lets clients render a live timer. */
  questionStartedAt: number | null;
  /** Total number of questions (mirrors QUESTIONS.length, sent so the
   *  client doesn't need to import the array just to render progress). */
  totalQuestions: number;
}

// ─── Client → Server messages ────────────────────────────────────────────

export interface HostClaimMessage {
  type: "host-claim";
  /** Shared secret from NEXT_PUBLIC_HOST_KEY (env). */
  hostKey: string;
}

export interface StartQuizMessage {
  type: "start";
}

export interface RevealAnswerMessage {
  type: "reveal";
  /** Correct option index for MCQ questions. */
  correctIndex?: number;
  /** Expected text/number for free-form questions (case-insensitive trim
   *  match). For text-input questions, fall back to `correctIndex` is not
   *  applicable. */
  correctText?: string;
  /** If true, any submitted answer counts as correct (subjective Qs). */
  acceptAny?: boolean;
}

export interface NextQuestionMessage {
  type: "next-question";
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
}

export interface SubmitAnswerMessage {
  type: "submit-answer";
  /** Index of the diamond option chosen, OR the typed text for text-input
   *  questions, OR a numeric value for number-input questions. */
  answer: number | string;
}

export interface JoinViewerMessage {
  type: "join-viewer";
  name?: string;
}

export type ClientMessage =
  | HostClaimMessage
  | StartQuizMessage
  | RevealAnswerMessage
  | NextQuestionMessage
  | ResetRoomMessage
  | KickMessage
  | JoinParticipantMessage
  | SubmitAnswerMessage
  | JoinViewerMessage;

// ─── Server → Client messages ────────────────────────────────────────────

export interface StateUpdateMessage {
  type: "state";
  state: RoomState;
}

export interface ErrorMessage {
  type: "error";
  reason: string;
}

/** Sent only to the connection that issued the kick target. */
export interface KickedMessage {
  type: "kicked";
}

export type ServerMessage = StateUpdateMessage | ErrorMessage | KickedMessage;
