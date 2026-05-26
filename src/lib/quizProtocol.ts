/**
 * Wire protocol shared between the PartyKit server (party/quiz.ts) and
 * the React clients (host / play / watch pages). Both sides import these
 * types so the message shape stays in sync.
 *
 * Live-quiz model (after the rich-QuestionScreen rewrite):
 * ─────────────────────────────────────────────────────────
 *   • Room phase: lobby → running → ended. Driven by the host's
 *     "start" / "end" actions. No per-question reveal phase any
 *     more — each player runs through Q1–Q10 independently at their
 *     own pace using the existing rich QuestionScreen UI.
 *   • Per-participant progress (currentQuestionIdx, score) lives on
 *     the server. Each client computes its own answer correctness
 *     (matching the solo flow's checks, including OpenAI for text
 *     questions) and reports the result via "report-answer". The
 *     server is authoritative for tallies but not for grading.
 *   • Question CONTENT is still NOT on the wire — clients import the
 *     same QUESTIONS array from src/components/QuizGame.
 */

export type RoomPhase = "lobby" | "running" | "ended";

export interface ParticipantState {
  /** Stable PartyKit connection id. */
  id: string;
  name: string;
  /** Current 0-based question the participant is on. Equals
   *  totalQuestions when they have finished. */
  currentQuestionIdx: number;
  /** Cumulative correct-answer count. */
  score: number;
  /** Per-question answer log. answers[i] is the answer they gave for
   *  Q<i+1>, or null if they didn't reach that question yet. */
  answers: (number | string | null)[];
  /** Per-question correctness log. Parallel to answers. */
  correctness: (boolean | null)[];
  /** Wall-clock ms when this participant finished (idx === total).
   *  Null while they are still playing. */
  finishedAt: number | null;
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
  /** Mirrors QUESTIONS.length on the client. */
  totalQuestions: number;
}

// ─── Client → Server messages ────────────────────────────────────────────

export interface HostClaimMessage {
  type: "host-claim";
  hostKey: string;
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
}

/** Sent by the participant after they answer (or time out) on a
 *  question. The client computes correctness from its own copy of
 *  QUESTIONS and just reports the verdict — the server trusts it and
 *  tallies. `questionIdx` is the question this answer is for; the
 *  server treats it as the participant's NEW currentQuestionIdx + 1
 *  after recording. */
export interface ReportAnswerMessage {
  type: "report-answer";
  questionIdx: number;
  answer: number | string | null;
  correct: boolean;
}

export interface JoinViewerMessage {
  type: "join-viewer";
  name?: string;
}

export type ClientMessage =
  | HostClaimMessage
  | StartQuizMessage
  | EndQuizMessage
  | ResetRoomMessage
  | KickMessage
  | JoinParticipantMessage
  | ReportAnswerMessage
  | JoinViewerMessage;

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
