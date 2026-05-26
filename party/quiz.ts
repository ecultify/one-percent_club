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
 * Quiz room server. One PartyKit room per active quiz session — the
 * room id is the share code participants enter (e.g. "ABC123"). The
 * first client to send a valid `host-claim` message becomes the room
 * host and is the only connection allowed to fire start / end / reset
 * / kick.
 *
 * Live-quiz model:
 *   • Room phase: lobby → running → ended.
 *   • Once running, each participant runs through Q1–Q10 at their own
 *     pace using the rich QuestionScreen UI on the client. The client
 *     computes correctness locally (matching the solo flow's logic) and
 *     reports the verdict back via "report-answer". The server is
 *     authoritative for tallies but not for grading.
 *   • The host has no per-question controls — they just start the room
 *     and end it whenever. End fires the final-leaderboard view for all
 *     connected clients.
 */

const TOTAL_QUESTIONS = 10;

interface ConnState {
  role: "host" | "participant" | "viewer" | "unclaimed";
  name?: string;
}

export default class QuizServer implements Party.Server {
  private phase: RoomPhase = "lobby";
  private hostId: string | null = null;
  private participants = new Map<string, ParticipantState>();
  private viewers = new Map<string, ViewerState>();
  private startedAt: number | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection) {
    connection.setState({ role: "unclaimed" });
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
        this.reportAnswer(sender, msg.questionIdx, msg.answer, msg.correct);
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
    this.sendTo(connection, { type: "identity", id: connection.id, role: "host" });
    this.broadcastState();
  }

  private startQuiz() {
    if (this.phase !== "lobby") return;
    this.phase = "running";
    this.startedAt = Date.now();
    // Reset per-participant progress so a "lobby → start" sequence
    // always begins everyone at Q1, even if a previous reset left
    // stale answers on connections that re-joined.
    for (const p of this.participants.values()) {
      p.currentQuestionIdx = 0;
      p.score = 0;
      p.answers = [];
      p.correctness = [];
      p.finishedAt = null;
    }
    this.broadcastState();
  }

  private endQuiz() {
    if (this.phase === "ended") return;
    this.phase = "ended";
    // Mark anyone still mid-quiz as finished so the leaderboard freezes.
    const now = Date.now();
    for (const p of this.participants.values()) {
      if (p.finishedAt == null) p.finishedAt = now;
    }
    this.broadcastState();
  }

  private resetRoom() {
    this.phase = "lobby";
    this.startedAt = null;
    for (const p of this.participants.values()) {
      p.currentQuestionIdx = 0;
      p.score = 0;
      p.answers = [];
      p.correctness = [];
      p.finishedAt = null;
    }
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
    const trimmed = (name || "").trim().slice(0, 32) || "Player";
    const existing = this.participants.get(connection.id);
    if (existing) {
      existing.name = trimmed;
    } else {
      this.participants.set(connection.id, {
        id: connection.id,
        name: trimmed,
        currentQuestionIdx: 0,
        score: 0,
        answers: [],
        correctness: [],
        finishedAt: null,
      });
    }
    connection.setState({ role: "participant", name: trimmed });
    this.sendTo(connection, { type: "identity", id: connection.id, role: "participant" });
    this.broadcastState();
  }

  private joinViewer(connection: Party.Connection, name?: string) {
    const trimmed = name?.trim().slice(0, 32);
    this.viewers.set(connection.id, { id: connection.id, name: trimmed });
    connection.setState({ role: "viewer", name: trimmed });
    this.sendTo(connection, { type: "identity", id: connection.id, role: "viewer" });
    this.broadcastState();
  }

  private reportAnswer(
    connection: Party.Connection,
    questionIdx: number,
    answer: number | string | null,
    correct: boolean,
  ) {
    if (this.phase !== "running") {
      this.sendTo(connection, { type: "error", reason: "quiz-not-running" });
      return;
    }
    const p = this.participants.get(connection.id);
    if (!p) {
      this.sendTo(connection, { type: "error", reason: "not-a-participant" });
      return;
    }
    if (p.finishedAt != null) return; // already done
    // Trust the client's questionIdx but clamp to prevent skipping.
    if (questionIdx !== p.currentQuestionIdx) {
      // Late / out-of-order report. Accept it but only if it matches
      // current position; otherwise drop silently so the leaderboard
      // stays consistent.
      this.sendTo(connection, { type: "error", reason: "wrong-question-idx" });
      return;
    }
    // Pad the per-question logs in case earlier entries are missing
    // (shouldn't happen, but be defensive).
    while (p.answers.length < questionIdx) p.answers.push(null);
    while (p.correctness.length < questionIdx) p.correctness.push(null);
    p.answers[questionIdx] = answer;
    p.correctness[questionIdx] = correct;
    if (correct) p.score += 1;
    p.currentQuestionIdx = questionIdx + 1;
    if (p.currentQuestionIdx >= TOTAL_QUESTIONS) {
      p.finishedAt = Date.now();
    }
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

  private snapshot(): RoomState {
    return {
      phase: this.phase,
      hostId: this.hostId,
      participants: Array.from(this.participants.values()),
      viewers: Array.from(this.viewers.values()),
      startedAt: this.startedAt,
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
