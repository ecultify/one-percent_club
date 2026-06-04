import type * as Party from "partykit/server";
import type {
  ClientMessage,
  ParticipantState,
  RoomPhase,
  RoomState,
  RoundPhase,
  ServerMessage,
  ViewerState,
} from "../src/lib/quizProtocol";

/**
 * Quiz room server. One PartyKit room per active quiz session — the
 * room id is the share code participants enter (e.g. "ABC123"). The
 * first client to send a valid `host-claim` message becomes the room
 * host and is the only connection allowed to fire start / end / reset
 * / kick.
 *
 * Synchronized "1% Club"-style model:
 *   • Room phase: lobby → running → ended.
 *   • While running, the SERVER drives one shared question for everyone
 *     (currentQuestionIdx) and a per-question sub-phase
 *     (roundPhase: "asking" → "revealing"):
 *       – On "start" (and after each reveal) the server opens a round:
 *         roundPhase = "narrating" while the question's voice-over plays
 *         for the whole room at once, then "asking" once the VO is done
 *         and a fresh clock starts.
 *       – Players answer within the clock. A wrong answer / timeout
 *         eliminates the player for the rest of the quiz. A correct
 *         answer survives. Response time is recorded for tiebreaks.
 *       – When the clock runs out (or every survivor has answered), the
 *         server flips to "revealing": anyone who didn't answer is
 *         eliminated, the correct answer is shown for a short hold.
 *       – After the hold the server advances everyone to the next
 *         question together, or ends the quiz when the questions run
 *         out or no survivors remain.
 *   • The client computes correctness locally and reports it via
 *     "report-answer"; the server is authoritative for the clock,
 *     elimination and tallies.
 */

const TOTAL_QUESTIONS = 10;

/** All questions use a 30s clock on the client. The server mirrors that
 *  with a small grace so a player answering on their visible "0" still
 *  beats the authoritative cutoff despite network latency. */
const QUESTION_TIME_MS = 30_000;
const ANSWER_GRACE_MS = 1_500;
/** How long the correct answer is held on screen before advancing. */
const REVEAL_HOLD_MS = 2_500;

/** Per-question voice-over duration (ms), indexed by question position
 *  (Q1 → index 0), measured from the VO mp3s + a buffer that covers
 *  client-side load/decode latency so the clock doesn't start before the
 *  VO finishes for everyone. The clock is held this long in the
 *  "narrating" sub-phase before flipping to "asking". Keep in sync with
 *  the VO files resolved by src/components/live/questionVo.ts. */
const VO_BUFFER_MS = 1_000;
const VO_DURATION_MS = [9_875, 16_980, 6_766, 8_960, 12_356, 12_539, 11_233, 8_908, 11_651, 6_583].map(
  (d) => d + VO_BUFFER_MS,
);
const DEFAULT_VO_MS = 10_000 + VO_BUFFER_MS;

interface ConnState {
  role: "host" | "participant" | "viewer" | "unclaimed";
  name?: string;
}

function freshParticipant(id: string, name: string, lateJoin = false): ParticipantState {
  return {
    id,
    name,
    score: 0,
    answers: [],
    correctness: [],
    times: [],
    eliminated: lateJoin,
    eliminatedAtQuestion: null,
    lateJoin,
  };
}

export default class QuizServer implements Party.Server {
  private phase: RoomPhase = "lobby";
  private hostId: string | null = null;
  private participants = new Map<string, ParticipantState>();
  private viewers = new Map<string, ViewerState>();
  private startedAt: number | null = null;

  // ── Synchronized round state ──────────────────────────────────────────
  private currentQuestionIdx = 0;
  private roundPhase: RoundPhase = "asking";
  private questionStartedAt: number | null = null;
  /** Connection ids that have submitted an answer for the current round. */
  private answeredThisRound = new Set<string>();
  /** Pending round transition (reveal / advance). */
  private roundTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection) {
    connection.setState({ role: "unclaimed" } satisfies ConnState);
    this.sendTo(connection, { type: "state", state: this.snapshot() });
  }

  onMessage(rawMessage: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      const text = typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage as ArrayBuffer);
      msg = JSON.parse(text) as ClientMessage;
    } catch {
      this.sendTo(sender, { type: "error", reason: "invalid-json" });
      return;
    }

    switch (msg.type) {
      case "host-claim":
        this.handleHostClaim(sender, msg.hostKey);
        return;
      case "start":
        this.requireHost(sender, () => this.startQuiz());
        return;
      case "end":
        this.requireHost(sender, () => this.endQuiz());
        return;
      case "reset":
        this.requireHost(sender, () => this.resetRoom());
        return;
      case "kick":
        this.requireHost(sender, () => this.kickParticipant(msg.participantId));
        return;
      case "join-participant":
        this.joinParticipant(sender, msg.name);
        return;
      case "report-answer":
        this.reportAnswer(sender, msg.questionIdx, msg.answer, msg.correct, msg.elapsedMs);
        return;
      case "join-viewer":
        this.joinViewer(sender, msg.name);
        return;
      default: {
        const _exhaustive: never = msg;
        void _exhaustive;
        this.sendTo(sender, { type: "error", reason: "unknown-message-type" });
      }
    }
  }

  onClose(connection: Party.Connection) {
    if (connection.id === this.hostId) {
      // Host disconnected — leave the room intact so they can reconnect
      // with the same hostKey. Null hostId so a fresh claim can take.
      this.hostId = null;
      this.broadcastState();
      return;
    }
    if (this.participants.delete(connection.id)) {
      this.answeredThisRound.delete(connection.id);
      // A departure might mean every remaining survivor has answered.
      this.maybeRevealEarly();
      this.broadcastState();
    } else if (this.viewers.delete(connection.id)) {
      this.broadcastState();
    }
  }

  // ─── Host actions ──────────────────────────────────────────────────────

  private handleHostClaim(connection: Party.Connection, hostKey: string) {
    const expected = (this.room.env.HOST_KEY as string | undefined) ?? "DEV";
    if (hostKey !== expected) {
      this.sendTo(connection, { type: "error", reason: "bad-host-key" });
      return;
    }
    if (this.hostId && this.hostId !== connection.id) {
      this.sendTo(connection, { type: "error", reason: "host-already-claimed" });
      return;
    }
    this.hostId = connection.id;
    connection.setState({ role: "host" } satisfies ConnState);
    this.sendTo(connection, { type: "identity", id: connection.id, role: "host" });
    this.broadcastState();
  }

  private startQuiz() {
    if (this.phase !== "lobby") return;
    this.phase = "running";
    this.startedAt = Date.now();
    // Reset everyone to a clean slate at Q1.
    for (const p of this.participants.values()) {
      p.score = 0;
      p.answers = [];
      p.correctness = [];
      p.times = [];
      p.eliminated = false;
      p.eliminatedAtQuestion = null;
      p.lateJoin = false;
    }
    this.currentQuestionIdx = 0;
    this.beginRound();
  }

  private endQuiz() {
    if (this.phase === "ended") return;
    this.clearRoundTimer();
    this.phase = "ended";
    this.roundPhase = "revealing";
    this.questionStartedAt = null;
    this.broadcastState();
  }

  private resetRoom() {
    this.clearRoundTimer();
    this.phase = "lobby";
    this.startedAt = null;
    this.currentQuestionIdx = 0;
    this.roundPhase = "asking";
    this.questionStartedAt = null;
    this.answeredThisRound.clear();
    for (const p of this.participants.values()) {
      p.score = 0;
      p.answers = [];
      p.correctness = [];
      p.times = [];
      p.eliminated = false;
      p.eliminatedAtQuestion = null;
      p.lateJoin = false;
    }
    this.broadcastState();
  }

  private kickParticipant(participantId: string) {
    if (!this.participants.delete(participantId)) return;
    this.answeredThisRound.delete(participantId);
    const conn = this.room.getConnection(participantId);
    if (conn) {
      this.sendTo(conn, { type: "kicked" });
      conn.close(4001, "kicked");
    }
    this.maybeRevealEarly();
    this.broadcastState();
  }

  // ─── Round engine ────────────────────────────────────────────────────

  /** Open the current question with its voice-over. The clock is frozen
   *  while the VO plays for the whole room; once it finishes the round
   *  flips to "asking". */
  private beginRound() {
    if (this.phase !== "running") return;
    this.roundPhase = "narrating";
    this.questionStartedAt = null;
    this.answeredThisRound.clear();
    this.clearRoundTimer();
    const voMs = VO_DURATION_MS[this.currentQuestionIdx] ?? DEFAULT_VO_MS;
    this.roundTimer = setTimeout(() => this.beginAsking(), voMs);
    this.broadcastState();
  }

  /** VO finished — start the answer clock for everyone at once. */
  private beginAsking() {
    if (this.phase !== "running" || this.roundPhase !== "narrating") return;
    this.roundPhase = "asking";
    this.questionStartedAt = Date.now();
    this.clearRoundTimer();
    this.roundTimer = setTimeout(() => this.beginReveal(), QUESTION_TIME_MS + ANSWER_GRACE_MS);
    this.broadcastState();
    // Edge case: a round with no live players (everyone already out, or
    // nobody joined) — let the clock run; advance handles end-of-game.
  }

  /** Close the current question: eliminate anyone who didn't answer, show
   *  the correct answer, then schedule the advance. */
  private beginReveal() {
    if (this.phase !== "running" || this.roundPhase !== "asking") return;
    const idx = this.currentQuestionIdx;
    for (const p of this.participants.values()) {
      if (p.eliminated) continue;
      if (!this.answeredThisRound.has(p.id)) {
        // Ran out the clock without answering → out.
        this.padTo(p, idx);
        p.answers[idx] = null;
        p.correctness[idx] = false;
        p.times[idx] = null;
        p.eliminated = true;
        p.eliminatedAtQuestion = idx;
      }
    }
    this.roundPhase = "revealing";
    this.clearRoundTimer();
    this.roundTimer = setTimeout(() => this.advanceRound(), REVEAL_HOLD_MS);
    this.broadcastState();
  }

  /** Move everyone to the next question, or end the quiz. */
  private advanceRound() {
    if (this.phase !== "running") return;
    const survivors = this.survivorCount();
    const nextIdx = this.currentQuestionIdx + 1;
    if (survivors === 0 || nextIdx >= TOTAL_QUESTIONS) {
      this.endQuiz();
      return;
    }
    this.currentQuestionIdx = nextIdx;
    this.beginRound();
  }

  /** If every surviving player has already answered, reveal immediately
   *  instead of waiting out the clock. */
  private maybeRevealEarly() {
    if (this.phase !== "running" || this.roundPhase !== "asking") return;
    if (this.participants.size === 0) return;
    for (const p of this.participants.values()) {
      // A survivor who hasn't answered yet — keep the clock running.
      if (!p.eliminated && !this.answeredThisRound.has(p.id)) return;
    }
    this.beginReveal();
  }

  // ─── Participant / viewer actions ─────────────────────────────────────

  private joinParticipant(connection: Party.Connection, name: string) {
    const trimmed = (name || "").trim().slice(0, 32) || "Player";
    const existing = this.participants.get(connection.id);
    if (existing) {
      existing.name = trimmed;
    } else {
      // Joining after the quiz already started → spectate (out from the
      // start). In the lobby they join as a full player.
      const lateJoin = this.phase !== "lobby";
      const p = freshParticipant(connection.id, trimmed, lateJoin);
      // -1 marks "never in the running" so they sort below everyone who
      // actually played a round.
      if (lateJoin) p.eliminatedAtQuestion = -1;
      this.participants.set(connection.id, p);
    }
    connection.setState({ role: "participant", name: trimmed } satisfies ConnState);
    this.sendTo(connection, { type: "identity", id: connection.id, role: "participant" });
    this.broadcastState();
  }

  private joinViewer(connection: Party.Connection, name?: string) {
    const trimmed = name?.trim().slice(0, 32);
    this.viewers.set(connection.id, { id: connection.id, name: trimmed });
    connection.setState({ role: "viewer", name: trimmed } satisfies ConnState);
    this.sendTo(connection, { type: "identity", id: connection.id, role: "viewer" });
    this.broadcastState();
  }

  private reportAnswer(
    connection: Party.Connection,
    questionIdx: number,
    answer: number | string | null,
    correct: boolean,
    elapsedMs: number,
  ) {
    if (this.phase !== "running") {
      this.sendTo(connection, { type: "error", reason: "quiz-not-running" });
      return;
    }
    if (this.roundPhase !== "asking") return; // round already revealing/closed
    const p = this.participants.get(connection.id);
    if (!p) {
      this.sendTo(connection, { type: "error", reason: "not-a-participant" });
      return;
    }
    if (p.eliminated) return; // out — spectating
    if (questionIdx !== this.currentQuestionIdx) {
      this.sendTo(connection, { type: "error", reason: "wrong-question-idx" });
      return;
    }
    if (this.answeredThisRound.has(connection.id)) return; // already answered

    const idx = this.currentQuestionIdx;
    this.padTo(p, idx);
    p.answers[idx] = answer;
    p.correctness[idx] = correct;
    p.times[idx] = Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs)) : null;
    this.answeredThisRound.add(connection.id);

    if (correct) {
      p.score += 1;
    } else {
      p.eliminated = true;
      p.eliminatedAtQuestion = idx;
    }

    this.broadcastState();
    this.maybeRevealEarly();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private padTo(p: ParticipantState, idx: number) {
    while (p.answers.length <= idx) p.answers.push(null);
    while (p.correctness.length <= idx) p.correctness.push(null);
    while (p.times.length <= idx) p.times.push(null);
  }

  private survivorCount(): number {
    let n = 0;
    for (const p of this.participants.values()) if (!p.eliminated) n += 1;
    return n;
  }

  private clearRoundTimer() {
    if (this.roundTimer != null) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  private requireHost(connection: Party.Connection, fn: () => void) {
    if (connection.id !== this.hostId) {
      this.sendTo(connection, { type: "error", reason: "not-host" });
      return;
    }
    fn();
  }

  private snapshot(): RoomState {
    return {
      phase: this.phase,
      hostId: this.hostId,
      participants: Array.from(this.participants.values()),
      viewers: Array.from(this.viewers.values()),
      startedAt: this.startedAt,
      totalQuestions: TOTAL_QUESTIONS,
      currentQuestionIdx: this.currentQuestionIdx,
      roundPhase: this.roundPhase,
      questionStartedAt: this.roundPhase === "asking" ? this.questionStartedAt : null,
    };
  }

  private broadcastState() {
    this.room.broadcast(JSON.stringify({ type: "state", state: this.snapshot() } satisfies ServerMessage));
  }

  private sendTo(connection: Party.Connection, msg: ServerMessage) {
    connection.send(JSON.stringify(msg));
  }
}
