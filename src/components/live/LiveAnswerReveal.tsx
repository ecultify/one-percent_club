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

/** Reveal copy keyed by set, then 0-based question position.
 *
 *  ⚠️ The `logic` strings are the CLIENT DOC's wording verbatim ("1% Club
 *  Questions.docx", Logic: line for each question) — do not paraphrase them.
 *  Only obvious doc typos are corrected (e.g. "timel." → "time.").
 *
 *  Images are NOT hard-coded here — they're pulled from the Question at render
 *  time (see resolveImage) so they always use our own set assets. */
const REVEAL: Record<QuestionSetId, RevealEntry[]> = {
  A: [
    { answer: "SHORT", logic: "The word short becomes ‘Shorter’ when you add the letters ‘ER’ to it." },
    { answer: "Glasses", image: "prompt", logic: "There are more glasses (Eye glasses, water glasses) compared to cards." },
    { answer: "Photo 3", image: "option", logic: "The photo showcases Jawaharlal Nehru wearing a smartwatch, which did not exist in that era." },
    { answer: "■ K", logic: "The pattern alternates between shapes (▲, ●, ■) and increases letters by two (A, C, E, G, I). The next is ■ K." },
    { answer: "Father", logic: "A is the father of B and C is the sister of B, so A is the father of both." },
    { answer: "January", logic: "Arranging April, February, January, June, March, May alphabetically puts January in the third position." },
    { answer: "June", logic: "January (31 days) + February (28 days) + March (31 days) + April (30 days) + May (31 days) = 151 days. Day 155 falls in June." },
    { answer: "Clock 2", image: "option", logic: "As per the conditions given only clock 2 fits the criteria i.e. at 4:33, 15 minutes ahead is 4:48, five minutes behind is 4:28." },
    { answer: "YOUTH", logic: "The missing letters (H, O, T, U, Y) spell “YOUTH”." },
    { answer: "SCOLD", image: "prompt", logic: "Remove the first letter to reveal an opposite (e.g., Yearly becomes Early, Slate becomes Late). The opposite of Hot is Cold; add an ‘S’ to get the 5 letter word Scold." },
  ],
  B: [
    { answer: "Short (or Small)", logic: "“Short” is the direct antonym of “Tall” in this context." },
    { answer: "The word 'the' is doubled", image: "prompt", logic: "The word “the” appears twice (the article is doubled)." },
    { answer: "Photo 1", image: "option", logic: "This photo shows a historical inaccuracy of mobile phones being present at a time during which it didn’t, that identifies it as a fake." },
    { answer: "The letter M", logic: "The letter “M” appears once in “minute”, twice in “moment”, and zero times in “thousand years”." },
    { answer: "Grandchild", logic: "A is the father of B and grandfather of C and D. Therefore, D is the grandchild of A." },
    { answer: "Japan", logic: "Alphabetically: Australia, England, India, Ireland, Japan. Japan comes last." },
    { answer: "August", logic: "January (31 days) + February (28 days) + March (31 days) + April (30 days) + May (31 days) + June (30 days) + July (31 days) = 212 days. Day 215 falls in August." },
    { answer: "Navin", logic: "The animals are Cat, Rabbit, Parrot, Snake, Tortoise. None start with N." },
    { answer: "FOUR", logic: "The missing letters (F, O, R, U) spell “FOUR”." },
    { answer: "UNT", image: "prompt", logic: "“UNT” completes “DISCOUNT” and “UNTANGLED”." },
  ],
  C: [
    { answer: "Second", logic: "If you pass the person in second place, you take their position (second)." },
    { answer: "Australia", image: "option", logic: "The flag tile showcases a New Zealand flag that does not match the country name labeled." },
    { answer: "Photo 1", image: "option", logic: "This image features Nelson Mandela wearing earpods that were not available at that time." },
    { answer: "Teapot", logic: "The word “Teapot” starts with T, ends with T, and has “tea” (T) inside it." },
    { answer: "His mother", logic: "The doctor is the boy's mother." },
    { answer: "A (August)", logic: "The sequence lists the first letter of each month (Jan, Feb, Mar, Apr, May, Jun, Jul). The next is August (A)." },
    { answer: "May", logic: "Counting backward from December 31 (Day 1) to January 1 (Day 365), Day 215 falls in May." },
    { answer: "Dina", image: "/questionscreenimages/setquestions/c8-children-hands-answer.png", logic: "Jenny's right hand is not held by anyone. Her left hand is held by Sade, whose left hand is held by Miko, whose left hand is held by Dina." },
    { answer: "ZEBRA", logic: "The missing letters (A, B, E, R, Z) spell “ZEBRA”." },
    { answer: "UNPREDICTABLY", image: "prompt", logic: "“Unpredictably” is the word where every letter is unique." },
  ],
  D: [
    { answer: "Her husband", logic: "Since Amit is married to Chitra, the relationship is defined by the marriage, making him her husband." },
    { answer: "France", image: "option", logic: "France is part of Europe whereas other countries are part of the Asian subcontinent." },
    { answer: "Tea with Karan", image: "option", logic: "The original talk show is titled “Koffee with Karan,” not “Tea with Karan,” making the latter an incorrect title for the show." },
    { answer: "Bigger", logic: "This follows a linguistic pattern where the comparative form of the adjective is created by adding “-er” (Short/Shorter, Tall/Taller, Big/Bigger)." },
    { answer: "Fourth", logic: "You finish in 4th place because finishing “two places ahead of 6th” is 4th (6 − 2 = 4), and finishing “immediately behind 3rd” is also 4th." },
    { answer: "J (July)", logic: "The sequence consists of the first letters of consecutive months (January, February, March, April, May, June). The next month is July, so the next letter is “J”." },
    { answer: "Ben", image: "prompt", logic: "Ben is the person sitting exactly two places to the right of the person sitting to the left of the person wearing the brown shirt." },
    { answer: "8", image: "prompt", logic: "Magnifying Glass = 3, Feather = 2, Basket = 1. Final addition: Magnifying Glass + Double Feather + Basket = 3 + (2 × 2) + 1 = 8." },
    { answer: "Dina", image: "/questionscreenimages/setquestions/c8-children-hands-answer.png", logic: "Jenny's right hand is not held by anyone. Her left hand is held by Sade, whose left hand is held by Miko, whose left hand is held by Dina." },
    { answer: "Clock B", image: "option", logic: "As per the conditions given only Clock B fits the criteria i.e. at 4:33, 15 minutes ahead is 4:48, five minutes behind is 4:28." },
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
