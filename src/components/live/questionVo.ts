/**
 * Resolves the per-question voice-over mp3 path. Shared by the live
 * player and the spectator view so both narrate the same file when the
 * server enters a question's "narrating" sub-phase.
 *
 * The VO durations the server holds the clock for (party/quiz.ts
 * VO_DURATION_MS) are measured from these exact files — keep them in
 * sync if a VO file is swapped.
 */
const VO_OVERRIDES: Record<number, string> = {
  1: "q1VO(canyoufindthemistake).mp3",
  2: "q2VO(gandhiji).mp3",
  3: "q3VO(cardsnglasses).mp3",
  5: "q5VOrevised.mp3",
};

const FOLDER_BY_QID: Record<number, string> = {
  1: "question1(findthemistake-90)",
  2: "question2(gandhijirealornot-80)",
  3: "question3(cardsnglasses-70)",
  4: "question4(jessicanmandy-60)",
  5: "question5(biggestsquare-50)",
  6: "question6(4transports-40)",
  7: "question7(earthnmars-30)",
  8: "question8(gymnast-20)",
  9: "question9(number1to6-10)",
  10: "question10(onepercent-1)",
};

export function questionVoSrc(id: number): string {
  const folder = FOLDER_BY_QID[id];
  const filename = VO_OVERRIDES[id] ?? `q${id}VO.mp3`;
  return encodeURI(`/questionscreenimages/${folder}/${filename}`);
}
