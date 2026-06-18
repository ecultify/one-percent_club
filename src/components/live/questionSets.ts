/**
 * Live-quiz question sets A / B / C (client brief "1% Club Questions.docx",
 * June 2026). The host picks a set at room creation; every player/viewer in
 * that room plays that set.
 *
 * Question CONTENT stays client-side (same model as the solo flow): the
 * PartyKit server only drives indices/clocks and imports the lightweight
 * src/lib/questionSetMeta.ts — never this file.
 *
 * Two questions are REUSED from the solo app lineup (per the brief):
 *   – QUESTIONS[0] "find the the mistake" → Set B, 80% slot
 *   – QUESTIONS[1] Gandhiji cannot-be-real → Set B, 70% slot
 * Set A's 80% cards/glasses keeps the solo flow's wording (and VO) but uses
 * the CLIENT DOC's image, where GLASSES win (doc's answer key).
 *
 * ⚠️ ANSWER DEVIATIONS FROM THE CLIENT DOC (deliberate — doc answers were
 *    wrong or assets forced a change). Flagged to the client:
 *   1. Set A 60%: sequence ▲A ●C ■E ▲G ●I forces K■. Doc's options had no
 *      K■ and marked "B■" correct. Options fixed to include K■ (correct).
 *   2. Set C 80%: the wrong flag is the "Australia" tile (it shows New
 *      Zealand's flag). Doc marked "Option A" (Ireland), which is a
 *      correct flag. Correct answer wired = Australia (option D).
 *   3. Set C 30%: counting backwards from Dec 31 = Day 1, Day 215 lands in
 *      MAY (doc said August — copy-paste from Set 2's forward count).
 *   4. Set C 1%: blanks force UNPREDICTABLY — CONFIRMED by the client.
 *      The doc's "no repeated letters" premise stays dropped from the
 *      wording since UNPREDICTABLY repeats letters.
 *
 * Resolved June 11: Set C 70% now uses the client's Mandela image (split
 * into 3 tiles); answer = Photo A per the client. Nehru placeholder gone.
 */
import { QUESTIONS, type Question } from "@/components/QuizGame";
import {
  type QuestionSetId,
  DEFAULT_QUESTION_SET,
  SET_LABELS,
  isQuestionSetId,
} from "@/lib/questionSetMeta";

export { SET_LABELS, isQuestionSetId, DEFAULT_QUESTION_SET };
export type { QuestionSetId };

const IMG = "/questionscreenimages/setquestions";

/** Nehru cannot-be-real question — Set A 70%. Photo C wears a smartwatch. */
function nehruQuestion(id: number): Question {
  return {
    id,
    percentage: 70,
    question: "Which of these photographs of Pandit Nehru cannot be real?",
    images: [`${IMG}/nehru-optA.png`, `${IMG}/nehru-optB.png`, `${IMG}/nehru-optC.png`],
    imagesAreOptions: true,
    options: ["Photo 1", "Photo 2", "Photo 3"],
    correctIndex: 2,
    timeLimit: 30,
  };
}

// ─── SET A (client doc "SET 1") ─────────────────────────────────────────────

const SET_A: Question[] = [
  {
    id: 1,
    percentage: 90,
    question: "Which word becomes “shorter” when you add two letters to it?",
    textInput: true,
    correctAnswerText:
      "SHORT — adding the two letters 'ER' to SHORT makes SHORTER. Accept the word 'short' in any casing, or an answer clearly identifying the word short. REJECT 'shorter' itself or any other word.",
    displayAnswer: "SHORT (short + er = shorter)",
    passRegex: "\\bshort\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Same question as the solo flow's cards/glasses, but with the CLIENT
    // DOC's gold-on-black image — in this artwork GLASSES outnumber cards,
    // so the correct answer is Glasses (matches the doc's answer key).
    // The wording is unchanged, so the existing q3 VO still fits.
    id: 2,
    percentage: 80,
    question: "What are there more of in this picture: cards or glasses?",
    image: `${IMG}/a2-cards-glasses.jpg`,
    options: ["Cards", "Glasses"],
    correctIndex: 1,
    timeLimit: 30,
  },
  nehruQuestion(3),
  {
    // DEVIATION #2: options corrected to include the true continuation K■.
    id: 4,
    percentage: 60,
    question: "Which figure and letter combination correctly completes the sequence?",
    wordSequence: ["▲ A", "● C", "■ E", "▲ G", "● I", "?"],
    options: ["B ●", "K ■", "L ▲", "Z ■"],
    correctIndex: 1,
    timeLimit: 30,
  },
  {
    id: 5,
    percentage: 50,
    question: "A is the father of B. C is the sister of B. What is A's relationship to C?",
    textInput: true,
    correctAnswerText:
      "A is C's FATHER. Accept 'father', 'dad', 'papa', 'pita' or a sentence saying A is the father of C. REJECT uncle, brother, grandfather or any other relation.",
    displayAnswer: "Father (A is C's father)",
    passRegex: "\\b(father|dad|papa|pita)\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 6,
    percentage: 40,
    question:
      "If the first six months of the year are arranged alphabetically, which month comes third in the new order?",
    textInput: true,
    correctAnswerText:
      "JANUARY. Alphabetical order of Jan–Jun: April, February, January, June, March, May — third is January. Accept 'january' or 'jan'. REJECT any other month.",
    displayAnswer: "January (April, February, January…)",
    passRegex: "\\bjan(uary)?\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 7,
    percentage: 30,
    question: "If January 1 is Day 1 and December 31 is Day 365, which month contains Day 155?",
    textInput: true,
    correctAnswerText:
      "JUNE. Days: Jan 31, Feb 28 (59), Mar 31 (90), Apr 30 (120), May 31 (151) — Day 155 is June 4. Accept 'june' or 'jun'. REJECT any other month.",
    displayAnswer: "June (Day 155 = June 4)",
    passRegex: "\\bjune?\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 8,
    percentage: 20,
    question:
      "One clock is 15 minutes fast, one is 5 minutes slow, one has stopped, and one shows the correct time. Which clock is correct?",
    images: [
      `${IMG}/clock-optA.png`,
      `${IMG}/clock-optB.png`,
      `${IMG}/clock-optC.png`,
      `${IMG}/clock-optD.png`,
    ],
    imagesAreOptions: true,
    compactImageRow: true,
    imageCaptions: ["1", "2", "3", "4"],
    options: ["Clock 1", "Clock 2", "Clock 3", "Clock 4"],
    correctIndex: 1, // 04:33 (04:48 is +15, 04:28 is −5, 05:01 stopped)
    timeLimit: 30,
  },
  {
    id: 9,
    percentage: 10,
    question: "A five-letter word is missing from this alphabetical sequence from A to Z. What is it?",
    wordPuzzle: "ABCDEFGIJKLMNPQRSVWXZ",
    textInput: true,
    correctAnswerText:
      "YOUTH — the missing letters are H, O, T, U, Y which spell YOUTH. Accept 'youth' in any casing. REJECT anything else.",
    displayAnswer: "YOUTH (missing: H O T U Y)",
    passRegex: "\\byouth\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 10,
    percentage: 1,
    question: "What five-letter common English word comes next in this sequence?",
    image: `${IMG}/a10-word-sequence.png`,
    textInput: true,
    correctAnswerText:
      "SCOLD. Each word hides another by dropping its first letter: nEARLY, sLATE, tHIGH, gLOW, kNEW, gOLD, sHOT → early/late, high/low, new/old, hot/? — the pair of HOT is COLD, so the word is SCOLD. Accept 'scold'. REJECT 'cold' alone.",
    displayAnswer: "SCOLD (hot → cold, s+COLD)",
    passRegex: "\\bscold\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
];

// ─── SET B (client doc "Set 2") ─────────────────────────────────────────────

const SET_B: Question[] = [
  {
    id: 1,
    percentage: 90,
    question: "The opposite of long is short. What is the opposite of tall?",
    textInput: true,
    correctAnswerText:
      "SHORT. The trick is that the opposite of tall is also 'short'. Accept 'short' in any casing. REJECT 'small', 'tiny' or other words.",
    displayAnswer: "Short",
    passRegex: "\\bshort\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // REUSED app question — "find the the mistake" (text input, OpenAI graded;
    // passRegex keeps the original bare-"the" fast pass).
    ...QUESTIONS[0],
    id: 2,
    percentage: 80,
    passRegex: "\\bthe\\b",
  },
  {
    // REUSED app question — Gandhiji cannot-be-real (3 image options).
    ...QUESTIONS[1],
    id: 3,
    percentage: 70,
  },
  {
    id: 4,
    percentage: 60,
    question: "What occurs once in a minute, twice in a moment, but never in a thousand years?",
    textInput: true,
    correctAnswerText:
      "The letter M. 'Minute' has one m, 'moment' has two, 'a thousand years' has none. Accept 'm', 'the letter m', 'letter m'. REJECT other letters or words.",
    displayAnswer: "The letter M",
    passRegex: "\\bm\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 5,
    percentage: 50,
    question: "A is the father of B. B is the father of C. C is the brother of D. What is D to A?",
    textInput: true,
    correctAnswerText:
      "GRANDCHILD. D is a child of B, so D is A's grandchild. Accept 'grandchild', 'grandson', 'granddaughter', 'grandkid', 'pota', 'poti'. REJECT child, nephew or other relations.",
    displayAnswer: "Grandchild",
    passRegex: "grand\\s*(child|son|daughter|kid)|\\bpot(a|i)\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 6,
    percentage: 40,
    question:
      "If the flags of these 5 countries were arranged alphabetically, which country would come last: Australia, England, Ireland, Japan, India?",
    textInput: true,
    correctAnswerText: "JAPAN — alphabetically last of the five. Accept 'japan'. REJECT the others.",
    displayAnswer: "Japan",
    passRegex: "\\bjapan\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 7,
    percentage: 30,
    question: "If January 1 is Day 1 and December 31 is Day 365, which month contains Day 215?",
    textInput: true,
    correctAnswerText:
      "AUGUST. Days through July = 212, so Day 215 is August 3. Accept 'august' or 'aug'. REJECT any other month.",
    displayAnswer: "August (Day 215 = August 3)",
    passRegex: "\\baug(ust)?\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 8,
    percentage: 20,
    question:
      "Rohan names his pets with the first letter of the animal — his dog is named Duncan. Which of these is NOT one of his pets' names?",
    images: [
      `${IMG}/pet-cat.png`,
      `${IMG}/pet-rabbit.png`,
      `${IMG}/pet-parrot.png`,
      `${IMG}/pet-snake.png`,
      `${IMG}/pet-tortoise.png`,
    ],
    compactImageRow: true,
    options: ["Caesar", "Ronit", "Pravin", "Tina", "Navin"],
    correctIndex: 4, // no animal starts with N (Cat, Rabbit, Parrot, Snake, Tortoise)
    timeLimit: 30,
  },
  {
    id: 9,
    percentage: 10,
    question: "A four-letter word is missing from this alphabetical sequence from A to Z. What is it?",
    wordPuzzle: "ABCDEGHIJKLMNPQSTVWXYZ",
    textInput: true,
    correctAnswerText:
      "FOUR — the missing letters are F, O, R, U which spell FOUR. Accept 'four' in any casing. REJECT anything else.",
    displayAnswer: "FOUR (missing: F O R U)",
    passRegex: "\\bfour\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 10,
    percentage: 1,
    question:
      "Which three letters replace the question marks so that both the blue and the pink underlined parts spell a word?",
    image: `${IMG}/b10-letter-blanks.png`,
    textInput: true,
    correctAnswerText:
      "UNT — DISCO + UNT = DISCOUNT (blue) and UNT + ANGLED = UNTANGLED (pink). Accept 'unt' (any casing/spacing), or 'discount/untangled' mentioned together. REJECT other letter triples.",
    displayAnswer: "UNT (DISCOUNT · UNTANGLED)",
    passRegex: "^u\\s*n\\s*t$",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
];

// ─── SET C (client doc "Set 3") ─────────────────────────────────────────────

const SET_C: Question[] = [
  {
    id: 1,
    percentage: 90,
    question:
      "If you are running in a race and you pass the person in second place, what position are you in?",
    textInput: true,
    correctAnswerText:
      "SECOND. Passing the person in second place puts you in second, not first. Accept 'second', '2nd'. REJECT 'first'.",
    displayAnswer: "Second",
    passRegex: "\\b(second|2nd)\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // DEVIATION #4: the wrong flag is the "Australia" tile (it shows the New
    // Zealand flag). Doc marked Option A (Ireland), which is a correct flag.
    id: 2,
    percentage: 80,
    question: "Spot what is wrong — one of these flags doesn't match its country. Which one?",
    images: [
      `${IMG}/flag-optA.png`,
      `${IMG}/flag-optB.png`,
      `${IMG}/flag-optC.png`,
      `${IMG}/flag-optD.png`,
      `${IMG}/flag-optE.png`,
    ],
    imagesAreOptions: true,
    compactImageRow: true,
    options: ["Ireland", "South Africa", "India", "Australia", "Italy"],
    correctIndex: 3,
    timeLimit: 30,
  },
  {
    // Client content delivered June 11 (combined image split into 3 tiles).
    // Photo A (the colour portrait) is the doctored one per the client's
    // answer key; B (1950s badge photo) and C (with Tutu) are real.
    id: 3,
    percentage: 70,
    question: "Which of these photographs of Nelson Mandela cannot be real?",
    images: [`${IMG}/mandela-optA.png`, `${IMG}/mandela-optB.png`, `${IMG}/mandela-optC.png`],
    imagesAreOptions: true,
    options: ["Photo 1", "Photo 2", "Photo 3"],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 4,
    percentage: 60,
    question: "What starts with T, ends with T, and has T in it?",
    textInput: true,
    correctAnswerText:
      "TEAPOT — starts with T, ends with T, and has TEA (T) in it. Accept 'teapot' or 'tea pot'. REJECT other words.",
    displayAnswer: "Teapot (it has tea in it)",
    passRegex: "tea\\s*pot",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 5,
    percentage: 50,
    question:
      "A doctor and a boy were fishing. The boy was the doctor's son, but the doctor was not the boy's father. Who was the doctor?",
    textInput: true,
    correctAnswerText:
      "The boy's MOTHER. Accept 'mother', 'mom', 'mum', 'his mother', 'maa', 'mummy'. REJECT father, stepfather, uncle, grandfather.",
    displayAnswer: "His mother",
    passRegex: "\\b(mother|mom|mum|maa|mummy|ma)\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 6,
    percentage: 40,
    question: "What comes next in this sequence?",
    wordPuzzle: "J F M A M J J ?",
    textInput: true,
    correctAnswerText:
      "A — the letters are the months January…July, so next is August (A). Accept 'a' or 'august'. REJECT other letters/months.",
    displayAnswer: "A (August)",
    passRegex: "^a$|\\baug(ust)?\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // DEVIATION #5: doc said August; counting backwards Day 215 lands in May.
    id: 7,
    percentage: 30,
    question: "If December 31 is Day 1 and January 1 is Day 365, which month contains Day 215?",
    textInput: true,
    correctAnswerText:
      "MAY. Counting backwards: Dec 31, Nov 61, Oct 92, Sep 122, Aug 153, Jul 184, Jun 214 — Day 215 is May 31. Accept 'may'. REJECT August or any other month.",
    displayAnswer: "May (Day 215 = May 31)",
    passRegex: "\\bmay\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 8,
    percentage: 20,
    question:
      "Who is holding the left hand of the child who is holding the left hand of the child who is next to a child whose right hand is not held by anyone?",
    image: `${IMG}/c8-children-hands.png`,
    textInput: true,
    correctAnswerText: "DINA. Accept 'dina' in any casing/spelling 'deena'. REJECT the other five names.",
    displayAnswer: "Dina",
    passRegex: "\\bd(i|ee)na\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 9,
    percentage: 10,
    question: "A five-letter word is missing from this alphabetical sequence from A to Z. What is it?",
    wordPuzzle: "CDFGHIJKLMNOPQSTUVWXY",
    textInput: true,
    correctAnswerText:
      "ZEBRA — the missing letters are A, B, E, R, Z which spell ZEBRA. Accept 'zebra' in any casing. REJECT anything else.",
    displayAnswer: "ZEBRA (missing: A B E R Z)",
    passRegex: "\\bzebra\\b",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // DEVIATION #6: reworded — the doc's "no repeated letters" premise is
    // impossible for the word its blanks force (UNPREDICTABLY has two letters
    // repeated). Answer confirmed as UNPREDICTABLY (the adverb form).
    id: 10,
    percentage: 1,
    question: "Fill in the blanks to complete the 13-letter English word. What is the word?",
    image: `${IMG}/c10-letter-blanks.png`,
    textInput: true,
    correctAnswerText:
      "UNPREDICTABLY — _NPR___C__B__ filled in is U-N-P-R-E-D-I-C-T-A-B-L-Y. Accept 'unpredictably' with minor typos. REJECT other words.",
    displayAnswer: "UNPREDICTABLY",
    passRegex: "un\\s*predict\\s*ably",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
];

// ─── Lookup API ─────────────────────────────────────────────────────────────

export const QUESTION_SETS: Record<QuestionSetId, Question[]> = {
  A: SET_A,
  B: SET_B,
  C: SET_C,
};

export function getQuestionSet(setId: QuestionSetId | undefined | null): Question[] {
  return QUESTION_SETS[setId && isQuestionSetId(setId) ? setId : DEFAULT_QUESTION_SET];
}

/**
 * Voice-over file per set/question position (0-based). Complete since the
 * June 2026 ElevenLabs batch — keep durations in SET_VO_DURATION_MS
 * (src/lib/questionSetMeta.ts) in sync if any file is swapped.
 *
 * The three reused questions point at their existing solo-flow VO files;
 * C pos 3 reuses a3VO (Nehru placeholder duplicates Set A's question).
 */
const Q = "/questionscreenimages";
const VO = `${Q}/setquestions/vo`;
const SET_VO_FILES: Record<QuestionSetId, (string | null)[]> = {
  A: [
    `${VO}/a1VO.mp3`,
    `${Q}/question3(cardsnglasses-70)/q3VO(cardsnglasses).mp3`,
    `${VO}/a3VO.mp3`,
    `${VO}/a4VO.mp3`,
    `${VO}/a5VO.mp3`,
    `${VO}/a6VO.mp3`,
    `${VO}/a7VO.mp3`,
    `${VO}/a8VO.mp3`,
    `${VO}/a9VO.mp3`,
    `${VO}/a10VO.mp3`,
  ],
  B: [
    `${VO}/b1VO.mp3`,
    `${Q}/question1(findthemistake-90)/q1VO(canyoufindthemistake).mp3`,
    `${Q}/question2(gandhijirealornot-80)/q2VO(gandhiji).mp3`,
    `${VO}/b4VO.mp3`,
    `${VO}/b5VO.mp3`,
    `${VO}/b6VO.mp3`,
    `${VO}/b7VO.mp3`,
    `${VO}/b8VO.mp3`,
    `${VO}/b9VO.mp3`,
    `${VO}/b10VO.mp3`,
  ],
  C: [
    `${VO}/c1VO.mp3`,
    `${VO}/c2VO.mp3`,
    // C3 became the Mandela question (June 11) — a3VO says "Pandit Nehru",
    // so it no longer fits. null = no narration until c3VO.mp3 is generated
    // (script in vo-scripts-hinglish.md); then also set its duration in
    // SET_VO_DURATION_MS.
    null,
    `${VO}/c4VO.mp3`,
    `${VO}/c5VO.mp3`,
    `${VO}/c6VO.mp3`,
    `${VO}/c7VO.mp3`,
    `${VO}/c8VO.mp3`,
    `${VO}/c9VO.mp3`,
    `${VO}/c10VO.mp3`,
  ],
};

export function setQuestionVoSrc(setId: QuestionSetId, questionIdx: number): string | null {
  const src = SET_VO_FILES[setId]?.[questionIdx] ?? null;
  return src ? encodeURI(src) : null;
}
