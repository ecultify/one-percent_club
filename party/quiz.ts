import type * as Party from "partykit/server";
import type {
  ClientMessage,
  ParticipantState,
  RoomPhase,
  RoomState,
  ServerMessage,
  ViewerState,
} from "../src/lib/quizProtocol";

/**
 * Quiz room server. One PartyKit room per active quiz session — the room
 * id is the share code participants enter (e.g. "ABC123"). The first
 * client to send a valid `host-claim` message becomes the room host and
 * gains exclusive control over phase transitions and kicks. Every other
 * connection is a participant or viewer.
 *
 * Question CONTENT lives in src/components/QuizGame.tsx (`QUESTIONS`);
 * the server only tracks `currentQuestionIdx` and per-participant scores.
 * That keeps the wire protocol thin and avoids duplicating the question
 * bank across server + client.
 */

/** How long an answer for the current question is still accepted after the
 *  host advances to "reveal" — keeps a tiny grace period for in-flight
 *  messages that arrive racing the reveal broadcast. */
const REVEAL_GRACE_MS = 250;

/** Total questions in the quiz. Mirrors QUESTIONS.length in
 *  src/components/QuizGame.tsx. Hardcoded here so the server has no
 *  client-side imports to drag in. If the question bank grows, update
 *  this constant. */
const TOTAL_QUESTIONS = 10;

/** Connection-level metadata. Stored via Connection.setState so we can
 *  reconnect the right role on resume. */
interface ConnState {
  role: "host" | "participant" | "viewer" | "unclaimed";
  /** Participant/viewer display name. */
  name?: string;
}

export default class QuizServer implements Party.Server {
  /** Current room phase. */
  private phase: RoomPhase = "lobby";
  private currentQuestionIdx = 0;
  private hostId: string | null = null;
  /** Persistent per-participant state keyed by Connection.id. */
  private participants = new Map<string, ParticipantState>();
  private viewers = new Map<string, ViewerState>();
  /** Per-question correct answer the host has revealed (set in reveal phase). */
  private revealedCorrectIndex: number | null = null;
  private revealedCorrectText: string | null = null;
  /** Wall-clock ms when the current "question" phase started. */
  private questionStartedAt: number | null = null;
  /** Timestamp of the last phase change — used for REVEAL_GRACE_MS. */
  private lastPhaseChangeAt = 0;

  constructor(readonly room: Party.Room) {}

  // ─── PartyKit lifecycle ────────────────────────────────────────────────

  onConnect(connection: Party.Connection) {
    connection.setState({ role: "unclaimed" });
    // Send current state right away so the client can render lobby /
    // current question / reveal immediately on connect.
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
      case "reveal":
        this.requireHost(sender, () =>
          this.revealAnswer(msg.correctIndex, msg.correctText, msg.acceptAny ?? false),
        );
        return;
      case "next-question":
        this.requireHost(sender, () => this.nextQuestion());
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
      case "submit-answer":
        this.submitAnswer(sender, msg.answer);
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
      // Host left — leave the room intact so they can reconnect, but
      // null out hostId so a fresh host-claim can take over.
      this.hostId = null;
      this.broadcastState();
      return;
    }
    if (this.participants.delete(connection.id)) this.broadcastState();
    else if (this.viewers.delete(connection.id)) this.broadcastState();
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
    connection.setState({ role: "host" });
    this.broadcastState();
  }

  private startQuiz() {
    if (this.phase !== "lobby") return;
    this.phase = "question";
    this.currentQuestionIdx = 0;
    this.revealedCorrectIndex = null;
    this.revealedCorrectText = null;
    this.questionStartedAt = Date.now();
    this.resetAnsweredFlags();
    this.touchPhase();
    this.broadcastState();
  }

  /** Host clicks "Reveal". The host UI looks up the correct answer in
   *  its local copy of QUESTIONS and ships it along — the server uses
   *  that to grade each participant's submitted answer and update their
   *  score. The server stays authoritative for scores even though the
   *  question content lives client-side. */
  private revealAnswer(correctIndex?: number, correctText?: string, acceptAny = false) {
    if (this.phase !== "question") return;
    this.phase = "reveal";
    this.revealedCorrectIndex = correctIndex ?? null;
    this.revealedCorrectText = correctText ?? null;
    const idx = this.currentQuestionIdx;
    for (const p of this.participants.values()) {
      const answer = p.answers[idx];
      if (answer == null) continue; // didn't submit → no points
      const correct = this.gradeAnswer(answer, correctIndex, correctText, acceptAny);
      if (correct) p.score += 1;
    }
    this.touchPhase();
    this.broadcastState();
  }

  private gradeAnswer(
    answer: number | string,
    correctIndex: number | undefined,
    correctText: string | undefined,
    acceptAny: boolean,
  ): boolean {
    if (acceptAny) return true;
    if (typeof answer === "number" && typeof correctIndex === "number") {
      return answer === correctIndex;
    }
    if (typeof answer === "string" && typeof correctText === "string") {
      const a = answer.trim().toLowerCase();
      const b = correctText.trim().toLowerCase();
      // Loose match: substring either way handles "the" vs "the the doubled".
      return a === b || a.includes(b) || b.includes(a);
    }
    return false;
  }

  private nextQuestion() {
    if (this.phase !== "reveal") return;
    const next = this.currentQuestionIdx + 1;
    if (next >= TOTAL_QUESTIONS) {
      this.phase = "ended";
      this.questionStartedAt = null;
      this.touchPhase();
      this.broadcastState();
      return;
    }
    this.currentQuestionIdx = next;
    this.phase = "question";
    this.revealedCorrectIndex = null;
    this.revealedCorrectText = null;
    this.questionStartedAt = Date.now();
    this.resetAnsweredFlags();
    this.touchPhase();
    this.broadcastState();
  }

  private resetRoom() {
    this.phase = "lobby";
    this.currentQuestionIdx = 0;
    this.revealedCorrectIndex = null;
    this.revealedCorrectText = null;
    this.questionStartedAt = null;
    for (const p of this.participants.values()) {
      p.score = 0;
      p.answers = [];
      p.eliminated = false;
      p.hasAnsweredThisRound = false;
    }
    this.touchPhase();
    this.broadcastState();
  }

  private kickParticipant(participantId: string) {
    if (!this.participants.delete(participantId)) return;
    const conn = this.room.getConnection(participantId);
    if (conn) {
      this.sendTo(conn, { type: "kicked" });
      conn.close(4001, "kicked");
    }
    this.broadcastState();
  }

  // ─── Participant / viewer actions ─────────────────────────────────────

  private joinParticipant(connection: Party.Connection, name: string) {
    if (this.phase !== "lobby") {
      // Late joiners during a live quiz become viewers automatically.
      this.joinViewer(connection, name);
      return;
    }
    const trimmed = (name || "").trim().slice(0, 32) || "Player";
    const existing = this.participants.get(connection.id);
    if (existing) {
      existing.name = trimmed;
    } else {
      this.participants.set(connection.id, {
        id: connection.id,
        name: trimmed,
        score: 0,
        answers: [],
        eliminated: false,
        hasAnsweredThisRound: false,
      });
    }
    connection.setState({ role: "participant", name: trimmed });
    this.broadcastState();
  }

  private joinViewer(connection: Party.Connection, name?: string) {
    const trimmed = name?.trim().slice(0, 32);
    this.viewers.set(connection.id, { id: connection.id, name: trimmed });
    connection.setState({ role: "viewer", name: trimmed });
    this.broadcastState();
  }

  private submitAnswer(connection: Party.Connection, answer: number | string) {
    const p = this.participants.get(connection.id);
    if (!p) {
      this.sendTo(connection, { type: "error", reason: "not-a-participant" });
      return;
    }
    // Allow submissions in "question" phase, plus a tiny grace window
    // immediately after the host hits "reveal" so messages already in
    // flight aren't dropped.
    const inWindow =
      this.phase === "question" ||
      (this.phase === "reveal" && Date.now() - this.lastPhaseChangeAt < REVEAL_GRACE_MS);
    if (!inWindow) {
      this.sendTo(connection, { type: "error", reason: "answers-closed" });
      return;
    }
    if (p.hasAnsweredThisRound) {
      // First answer wins — ignore subsequent submissions for the same
      // question.
      this.sendTo(connection, { type: "error", reason: "already-answered" });
      return;
    }
    p.hasAnsweredThisRound = true;
    while (p.answers.length < this.currentQuestionIdx) p.answers.push(null);
    p.answers[this.currentQuestionIdx] = answer;
    this.broadcastState();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private requireHost(connection: Party.Connection, fn: () => void) {
    if (connection.id !== this.hostId) {
      this.sendTo(connection, { type: "error", reason: "not-host" });
      return;
    }
    fn();
  }

  private resetAnsweredFlags() {
    for (const p of this.participants.values()) {
      p.hasAnsweredThisRound = false;
    }
  }

  private touchPhase() {
    this.lastPhaseChangeAt = Date.now();
  }

  private snapshot(): RoomState {
    return {
      phase: this.phase,
      currentQuestionIdx: this.currentQuestionIdx,
      hostId: this.hostId,
      participants: Array.from(this.participants.values()),
      viewers: Array.from(this.viewers.values()),
      revealedCorrectIndex: this.revealedCorrectIndex,
      revealedCorrectText: this.revealedCorrectText,
      questionStartedAt: this.questionStartedAt,
      totalQuestions: TOTAL_QUESTIONS,
    };
  }

  private broadcastState() {
    this.room.broadcast(JSON.stringify({ type: "state", state: this.snapshot() } satisfies ServerMessage));
  }

  private sendTo(connection: Party.Connection, msg: ServerMessage) {
    connection.send(JSON.stringify(msg));
  }
}
