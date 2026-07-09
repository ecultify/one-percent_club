"use client";

/* ─────────────────────────────────────────────────────────────────────────
 *  LiveAnswerReveal
 *  ─────────────────────────────────────────────────────────────────────────
 *  Full-screen answer reveal for the LIVE quiz, shown while the server holds
 *  the room in roundPhase === "revealing". It replicates the BEHAVIOUR of the
 *  solo flow's CorrectAnswerPanel (answer + plain-English logic, with the
 *  correct image for image questions) but, per the live design:
 *
 *    • it covers the WHOLE screen with a blurred backdrop over the question,
 *    • it shows the answer headline, a thin gold divider, and the logic text,
 *    • for image questions it shows the question's OWN correct image
 *      (q.images[correctIndex] for image-option questions, or q.image for a
 *      single-image prompt) — no assets are borrowed from the solo journey.
 *
 *  Content (the one-line logic + a clean answer label) is authored per set and
 *  question position below; the image is resolved from the live Question object
 *  at render time so it always matches the room's actual question set.
 *
 *  In manual-control mode the server parks this reveal indefinitely, so the
 *  whole room sits here until the host presses "Next question".
 *  ───────────────────────────────────────────────────────────────────────── */

import { motion, AnimatePresence } from "framer-motion";
import type { Question } from "@/components/QuizGame";
import type { QuestionSetId } from "@/lib/questionSetMeta";

/** How the correct image is sourced: "option" → the question's own correct
 *  option image, "prompt" → the question's own prompt image, or a literal
 *  "/…" path to a DEDICATED answer image (e.g. one that highlights the answer). */
type ImageMode = "option" | "prompt";

interface RevealEntry {
  /** Clean answer headline. Falls back to the question's displayAnswer / the
   *  correct option label when omitted. */
  answer?: string;
  /** Plain-English reason, the way a host would explain it after the round. */
  logic: string;
  /** Which image to show, if any: an ImageMode resolved from the question, or
   *  a literal "/…" path to a dedicated answer image. */
  image?: ImageMode | string;
}

/** Authored reveal copy keyed by set, then 0-based question position. Images
 *  are NOT hard-coded here — they're pulled from the Question at render time
 *  (see resolveImage) so they always use our own set assets. */
const REVEAL: Record<QuestionSetId, RevealEntry[]> = {
  A: [
    { answer: "SHORT", logic: "Add the two letters E and R to SHORT and it spells SHORTER. The word that turns 'shorter' is SHORT itself." },
    { answer: "Glasses", image: "prompt", logic: "Count again. The picture has more glasses than cards." },
    { answer: "Photo 3", image: "option", logic: "Photo 3 cannot be real. Nehru is wearing a smartwatch, something that did not exist in his time." },
    { answer: "■ K", logic: "The shapes cycle triangle, circle, square, and the letters climb A, C, E, G, I by two. The next in the sequence is ■ K." },
    { answer: "Father", logic: "A is B's father, and C is B's sister, so C is A's child too. That makes A the father of C." },
    { answer: "January", logic: "In alphabetical order the first six months run April, February, January, June, March, May. January sits third." },
    { answer: "June", logic: "The days up to the end of May add up to 151. Four more days reach June 4, so Day 155 falls in June." },
    { answer: "Clock 2", image: "option", logic: "Clock 2 shows the real time of 4:33. The rest are 15 minutes fast, 5 minutes slow, or stopped." },
    { answer: "YOUTH", logic: "The letters missing from A to Z are H, O, T, U and Y. Together they spell YOUTH." },
    { answer: "SCOLD", image: "prompt", logic: "Drop the first letter of each word to reveal its opposite. The opposite of HOT is COLD, so add an S to get SCOLD." },
  ],
  B: [
    { answer: "Short (or Small)", logic: "Long becomes short, and the opposite of tall is short as well. Small works too." },
    { answer: "The word 'the' is doubled", image: "prompt", logic: "Read the line slowly. The word 'the' is written twice in a row." },
    { answer: "Photo 1", image: "option", logic: "Photo 1 cannot be real. A mobile phone shows up in a time when none existed." },
    { answer: "The letter M", logic: "M appears once in 'minute', twice in 'moment', and never in 'a thousand years'." },
    { answer: "Grandchild", logic: "A is B's father and B is the father of C and D, so D is A's grandchild." },
    { answer: "Japan", logic: "Sorted alphabetically the five countries end on Japan, so it comes last." },
    { answer: "August", logic: "The days up to the end of July total 212. Three more days reach August 3, so Day 215 falls in August." },
    { answer: "Navin", logic: "Each name starts with its animal: Cat, Rabbit, Parrot, Snake, Tortoise. None starts with N, so Navin is not a pet." },
    { answer: "FOUR", logic: "The letters missing from A to Z are F, O, R and U. Together they spell FOUR." },
    { answer: "UNT", image: "prompt", logic: "Drop UNT into the blanks and both words appear: DISCOUNT in blue and UNTANGLED in pink." },
  ],
  C: [
    { answer: "Second", logic: "Overtake the runner in second place and you take their spot. You are second, not first." },
    { answer: "Australia", image: "option", logic: "The tile labelled Australia is showing New Zealand's flag, so that one does not match its country." },
    { answer: "Photo 1", image: "option", logic: "Photo 1 cannot be real. Mandela is wearing wireless earphones, which did not exist back then." },
    { answer: "Teapot", logic: "TEAPOT starts with T, ends with T, and has TEA tucked inside." },
    { answer: "His mother", logic: "The doctor is the boy's mother. The riddle expects a father, and that is the trick." },
    { answer: "A (August)", logic: "The letters are the first letters of the months from January to July. The next month is August, so A." },
    { answer: "May", logic: "Counting backwards from December 31, Day 215 lands on May 31." },
    { answer: "Dina", image: "/questionscreenimages/setquestions/c8-children-hands-answer.png", logic: "Jenny's right hand is not held by anyone. Her left hand is held by Sade, whose left hand is held by Miko, whose left hand is held by Dina." },
    { answer: "ZEBRA", logic: "The letters missing from A to Z are A, B, E, R and Z. Together they spell ZEBRA." },
    { answer: "UNPREDICTABLY", image: "prompt", logic: "The blanks fill in to spell UNPREDICTABLY, a 13-letter word with no repeated letter." },
  ],
  D: [
    { answer: "Her husband", logic: "Amit is married to Chitra, so he is simply her husband. The details about Seema and Mohan are there to distract you." },
    { answer: "France", image: "option", logic: "India, Sri Lanka, South Korea and China are all in Asia. France is in Europe, so it is the odd one out." },
    { answer: "Tea with Karan", image: "option", logic: "The real talk show is 'Koffee with Karan'. 'Tea with Karan' is the made-up title, so it cannot be real." },
    { answer: "Bigger", logic: "Each word adds -er for its comparative form: Short becomes Shorter, Tall becomes Taller, so Big becomes Bigger." },
    { answer: "Fourth", logic: "Two places ahead of 6th is 4th, and immediately behind 3rd is also 4th. Both clues point to the same spot." },
    { answer: "J (July)", logic: "The letters are the first letters of the months from January to June. The next month is July, so the next letter is J." },
    { answer: "Ben", image: "prompt", logic: "Alice is in the brown shirt. Start at the person on her left, count two places to the right, and you land on Ben." },
    { answer: "8", image: "prompt", logic: "The magnifying glass is 3, the feather is 2 and the basket is 1. So one glass, two feathers and a basket make 3 + 4 + 1 = 8." },
    { answer: "Dina", image: "/questionscreenimages/setquestions/c8-children-hands-answer.png", logic: "Jenny's right hand is not held by anyone. Her left hand is held by Sade, whose left hand is held by Miko, whose left hand is held by Dina." },
    { answer: "Clock B", image: "option", logic: "Clock B shows the real time of 4:33. The rest are 15 minutes fast, 5 minutes slow, or stopped." },
  ],
};

/** Outcome for THIS player, drives the small header label. */
export type RevealOutcome = "won" | "lost" | "missed" | "neutral";

function headerLabel(outcome: RevealOutcome): string {
  switch (outcome) {
    case "won":
      return "Correct!";
    case "missed":
      return "Time's up — the right answer";
    case "lost":
      return "The right answer";
    default:
      return "The answer";
  }
}

/** Resolve the reveal image: a dedicated answer-image path ("/…"), or the
 *  question's OWN correct-option / prompt image, or null. */
function resolveImage(q: Question, image: ImageMode | string | undefined): string | null {
  if (typeof image === "string" && image.startsWith("/")) return image;
  if (image === "option" && q.images && q.images.length > q.correctIndex) {
    return q.images[q.correctIndex] ?? null;
  }
  if (image === "prompt" && q.image) return q.image;
  return null;
}

export interface LiveAnswerRevealProps {
  setId: QuestionSetId;
  /** 0-based position of the current question in the set. */
  questionIndex: number;
  question: Question;
  visible: boolean;
  outcome: RevealOutcome;
}

export default function LiveAnswerReveal({
  setId,
  questionIndex,
  question,
  visible,
  outcome,
}: LiveAnswerRevealProps) {
  const entry = REVEAL[setId]?.[questionIndex];
  // Defensive: without authored copy, fall back to the question's own labels
  // so the reveal still shows something sensible.
  const answer =
    entry?.answer ?? question.displayAnswer ?? question.options[question.correctIndex] ?? "";
  const logic = entry?.logic ?? "";
  const imageSrc = resolveImage(question, entry?.image);
  const isWin = outcome === "won";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`live-reveal-${setId}-${questionIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="absolute inset-0 z-[40] flex items-center justify-center px-5 py-8 md:px-10"
          style={{
            // Full-screen blurred backdrop over the question beneath.
            background: "rgba(4, 3, 1, 0.72)",
            backdropFilter: "blur(18px) saturate(115%)",
            WebkitBackdropFilter: "blur(18px) saturate(115%)",
          }}
          aria-label="Answer reveal"
        >
          <motion.div
            initial={{ scale: 0.96, y: 14 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className={`relative w-full max-w-3xl rounded-2xl ${
              imageSrc ? "flex flex-col md:flex-row md:items-center gap-6 md:gap-8" : "flex flex-col items-center text-center"
            } px-7 py-8 md:px-10 md:py-9`}
            style={{
              background: "rgba(10, 7, 3, 0.78)",
              border: "1px solid rgba(228, 207, 106, 0.34)",
              boxShadow:
                "0 30px 80px -24px rgba(0,0,0,0.85), inset 0 0 50px rgba(0,0,0,0.4), 0 0 60px -20px rgba(228,174,68,0.28)",
            }}
          >
            {/* Correct image (our own set asset) — left on desktop, top on mobile. */}
            {imageSrc && (
              <div
                className="w-full md:w-[42%] shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                style={{
                  background: "rgba(8,5,2,0.6)",
                  border: "1px solid rgba(228,207,106,0.2)",
                  boxShadow: "inset 0 0 22px rgba(0,0,0,0.5)",
                  maxHeight: "46vh",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt="Correct answer"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            )}

            <div className={`flex flex-col ${imageSrc ? "flex-1 min-w-0" : "items-center"}`}>
              <p
                className="font-mono uppercase tracking-[0.34em] font-bold leading-none"
                style={{
                  color: isWin ? "var(--success, #6ee7a8)" : "var(--gold-bright, #f4dc7c)",
                  fontSize: "clamp(10px, 1.5vmin, 13px)",
                  textShadow: "0 1px 0 rgba(20,10,0,0.7), 0 0 12px rgba(228,174,68,0.3)",
                }}
              >
                {headerLabel(outcome)}
              </p>

              <p
                className="mt-4 font-display font-bold leading-none tracking-tight break-words"
                style={{
                  fontSize: "clamp(34px, 7.5vmin, 64px)",
                  backgroundImage:
                    "linear-gradient(180deg, #fff0c2 0%, #f9e89a 26%, #e4c55a 52%, #b28622 82%, #6d4e13 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  filter:
                    "drop-shadow(0 2px 8px rgba(0,0,0,0.7)) drop-shadow(0 0 14px rgba(228,207,106,0.4))",
                }}
              >
                {answer}
              </p>

              <div
                className={`my-5 md:my-6 h-px ${imageSrc ? "w-full" : "w-40"} shrink-0`}
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(228,207,106,0.7) 30%, rgba(228,207,106,0.7) 70%, transparent 100%)",
                }}
                aria-hidden
              />

              <p
                className="font-sans leading-relaxed"
                style={{
                  color: "rgba(245, 240, 220, 0.92)",
                  fontSize: "clamp(15px, 2.1vmin, 20px)",
                  textShadow: "0 1px 0 rgba(0,0,0,0.45)",
                }}
              >
                {logic}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
