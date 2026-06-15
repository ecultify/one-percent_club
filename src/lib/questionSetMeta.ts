/**
 * Set metadata shared by the PartyKit server AND the Next.js clients.
 *
 * ⚠️ KEEP THIS MODULE SERVER-SAFE: no React, no DOM, no imports from
 * component files. party/quiz.ts bundles whatever this file pulls in —
 * the full question CONTENT (text, images, answers) intentionally lives
 * client-side only (src/components/live/questionSets.ts) so it never
 * enters the realtime server bundle or the wire.
 *
 * The three live-quiz question sets (client brief, June 2026):
 *   Set A = client doc "SET 1", Set B = "Set 2", Set C = "Set 3".
 * The host picks a set when creating a lobby; the room plays that set.
 */

export type QuestionSetId = "A" | "B" | "C";

export const QUESTION_SET_IDS: QuestionSetId[] = ["A", "B", "C"];

export const SET_LABELS: Record<QuestionSetId, string> = {
  A: "Set A",
  B: "Set B",
  C: "Set C",
};

export const DEFAULT_QUESTION_SET: QuestionSetId = "A";

export function isQuestionSetId(v: unknown): v is QuestionSetId {
  return v === "A" || v === "B" || v === "C";
}

/*
 * Narration is configured PER ROOM by the host in the lobby (locked once
 * the quiz starts):
 *   – "Read out" (hostNarration): every round holds with the clock frozen
 *     while the host reads the question aloud, until the host presses
 *     "Start question timer". No recorded VO plays.
 *   – "Mute VO" (muteVo): the game follows normal server timing, but
 *     recorded VOs never play (useful while most questions still have no
 *     VO). Questions whose VO duration is null below are skipped
 *     automatically even when VOs are unmuted.
 */

/** Questions per set. All three sets ship the full 90%→1% ladder. */
export const SET_QUESTION_COUNT: Record<QuestionSetId, number> = {
  A: 10,
  B: 10,
  C: 10,
};

/**
 * Per-question voice-over duration in ms (ffprobe-measured from each mp3,
 * WITHOUT the network-grace buffer — the server adds that), indexed by
 * question position (Q1 → index 0). All 30 slots have a VO (June 2026
 * ElevenLabs batch in /questionscreenimages/setquestions/vo/). Keep in
 * sync with SET_VO_FILES in src/components/live/questionSets.ts.
 *
 * A null entry would make the server SKIP the "narrating" sub-phase for
 * that question and open the answer clock immediately.
 *
 * The three pre-existing solo-flow VOs are reused where their question
 * appears: cards/glasses (6,766 ms) → A pos 2; find-the-the (9,875 ms) →
 * B pos 2; Gandhiji (16,980 ms) → B pos 3. C pos 3 reuses a3VO (Nehru
 * placeholder duplicates Set A's question).
 */
export const SET_VO_DURATION_MS: Record<QuestionSetId, (number | null)[]> = {
  A: [14_472, 6_766, 11_416, 20_010, 14_054, 15_073, 15_282, 15_491, 16_249, 15_543],
  B: [17_137, 9_875, 16_980, 14_107, 13_871, 16_014, 14_864, 20_794, 16_118, 14_525],
  // C3 (Mandela, June 11) has no VO yet — null skips narration for that
  // round. Fill once c3VO.mp3 is generated (a3VO no longer fits: it names
  // Nehru, the question is now Mandela).
  C: [16_144, 14_629, null, 11_729, 16_536, 16_484, 13_819, 18_756, 14_525, 12_983],
};
