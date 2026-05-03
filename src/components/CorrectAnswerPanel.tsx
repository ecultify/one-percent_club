"use client";

/* ─────────────────────────────────────────────────────────────────────────
 *  CorrectAnswerPanel
 *  ─────────────────────────────────────────────────────────────────────────
 *  Side overlay that slides in from the right edge while the answer-reaction
 *  video plays — runs on correct, winner, AND wrong reactions so the audience
 *  always sees what the right answer was. Two visual variants per question:
 *
 *    Variant A (image): Q1, Q2, Q3, Q9 — uses the qN correct-image asset
 *                        + a one-line caption explaining what the image shows.
 *    Variant B (text):  Q4, Q5, Q6, Q7, Q8, Q10 — large answer headline,
 *                        thin gold divider, reasoning paragraph below.
 *
 *  The panel is rendered by QuizGame as a SIBLING of the reaction <video>
 *  inside the existing reaction overlay container, NOT as a layout sibling.
 *  It uses position: absolute and floats on top of the video so the video
 *  keeps its full-screen size.
 *
 *  Width: ~33% of the viewport on desktop, ~50% on screens narrower than
 *  768px (matches the spec for mobile readability).
 *
 *  Z-order inside the reaction overlay:
 *    video       (implicit z-0)
 *    PANEL       z-[5]  ← this component
 *    skip pill   z-10   ← stays on top so the host can skip mid-explanation
 *  ───────────────────────────────────────────────────────────────────── */

import { motion, AnimatePresence } from "framer-motion";

type PanelContent =
  | { type: "image"; src: string; caption: string }
  | { type: "text"; answer: string; reasoning: string };

/** Single source of truth for what the panel shows per question. Keyed by
 *  `Question.id` (1 through 10). Image paths are absolute under /public so
 *  they resolve directly from the static asset host.
 *
 *  Copy style: humanizer rules apply. No em dashes, no rule-of-three, no
 *  bullet-style separators (e.g. the older "Cards · Glasses" format), no
 *  AI-vocabulary words. Plain English, the way Anil Kapoor would explain
 *  it to a friend after the round. */
const PANEL_CONTENT: Record<number, PanelContent> = {
  1: {
    type: "image",
    src: "/questionscreenimages/question1(findthemistake-90)/q1correctimage.png",
    caption: "Look at the line again. The word 'the' is written twice in a row.",
  },
  2: {
    type: "image",
    src: "/questionscreenimages/question2(gandhijirealornot-80)/q2correctimage.png",
    caption:
      "Photo 1 is fake. Smartphones did not exist in Gandhi's lifetime, so he could never have posed with one.",
  },
  3: {
    type: "image",
    src: "/questionscreenimages/question3(cardsnglasses-70)/q3cardsnglassescorrect.png",
    caption:
      "Count carefully. There are 9 cards in the picture and only 7 glasses, so cards win.",
  },
  4: {
    type: "text",
    answer: "NAME",
    reasoning:
      "Jessica's only sister is Mandy. So Mandy is literally the name of Jessica's sister, and 'name' fills the blank.",
  },
  5: {
    type: "text",
    answer: "A",
    reasoning:
      "Only A is an actual square. B is a rectangle and C is a rhombus, so neither qualifies. The question only applies to A by default. The trick is in noticing which shapes are actually squares.",
  },
  6: {
    type: "text",
    answer: "2",
    reasoning:
      "Sort them low to high by passenger count and you get bike, car, bus, plane. Bike stays at position 1 and plane stays at position 4. Two of them stay put.",
  },
  7: {
    type: "text",
    answer: "ARMS",
    reasoning:
      "EARTH contains the letters of HEART. MARS contains the letters of ARMS. Same anagram trick on both planets.",
  },
  8: {
    type: "text",
    answer: "A",
    reasoning:
      "A is on the gymnast's own left side. From where you are watching it looks like the right, but the question is asked from the gymnast's perspective, not yours.",
  },
  9: {
    type: "image",
    src: "/questionscreenimages/question9(number1to6-10)/q9correctimage.png",
    caption:
      "Each circle uses one number from 1 to 6. The missing number is 3, because 1 plus 2 equals 3.",
  },
  10: {
    type: "text",
    answer: "NO",
    reasoning:
      "Add NO to the end and you get TNECREPENO. Read those letters backwards and they spell ONE PERCENT. That is the hidden phrase.",
  },
};

export interface CorrectAnswerPanelProps {
  /** 1..10 — matches the `Question.id` field in QuizGame's QUESTIONS array. */
  questionId: number;
  /** Drives the slide-in (true) / slide-out (false) animation via AnimatePresence. */
  visible: boolean;
  /** Which reaction is currently playing. Drives the small header label
   *  ("Correct Answer" vs "The Right Answer Was") so the panel speaks
   *  appropriately to the moment. null is treated as the correct/winner
   *  case (defensive default). */
  reactionKind?: "correct" | "wrong" | "winner" | null;
}

export default function CorrectAnswerPanel({
  questionId,
  visible,
  reactionKind = null,
}: CorrectAnswerPanelProps) {
  const content = PANEL_CONTENT[questionId];

  // Defensive: if the questionId doesn't have a panel mapping (shouldn't
  // happen for ids 1-10, but guards future additions), render nothing.
  if (!content) return null;

  // Header label adapts to the reaction. On wrong reactions the framing
  // shifts from celebrating the player to teaching what the right answer
  // was. Same content underneath either way — the explanation is universal.
  const headerLabel =
    reactionKind === "wrong" ? "The Right Answer Was" : "Correct Answer";

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key={`correct-panel-${questionId}`}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{
            // Slide-in: 400ms ease-out per spec.
            // exit transition is read by AnimatePresence from the same prop;
            // we shorten it to 300ms via the explicit duration override below.
            duration: 0.4,
            ease: [0.23, 1, 0.32, 1],
          }}
          // Width breakpoints: mobile (under 768px) → 50% of viewport,
          // desktop (≥ md) → 33% of viewport. Capped at 520px so it never
          // dominates an ultrawide display. Min of 320px protects very
          // narrow phones from collapsing too tight.
          className="absolute right-0 top-0 h-full w-1/2 md:w-1/3 max-w-[520px] min-w-[320px] z-[5] flex flex-col"
          style={{
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(8px) saturate(120%)",
            WebkitBackdropFilter: "blur(8px) saturate(120%)",
            // Thin gold border ON THE LEFT EDGE ONLY — separates the panel
            // from the underlying video so the seam reads cleanly.
            borderLeft: "1px solid rgba(228, 207, 106, 0.55)",
            boxShadow:
              "inset 18px 0 36px -18px rgba(0,0,0,0.6), -8px 0 24px -8px rgba(0,0,0,0.55)",
          }}
          aria-label="Correct answer explanation"
        >
          {/* Inner content frame — generous padding all around. Uses flex
              column so Variant A (image) and Variant B (text) can both
              center vertically without separate layout branches. */}
          <div className="relative flex flex-col h-full px-6 md:px-8 py-7 md:py-8 gap-4 md:gap-5 overflow-y-auto">
            {/* "CORRECT ANSWER" label — small, gold, letter-spaced caps.
                Same visual language as the rest of the show's mono labels
                (e.g. the pot/players HUD chips, the Journey ticker label). */}
            <p
              className="font-mono uppercase tracking-[0.32em] font-bold leading-none shrink-0"
              style={{
                color: "var(--gold-bright, #f4dc7c)",
                fontSize: "clamp(10px, 1.4vmin, 13px)",
                textShadow:
                  "0 1px 0 rgba(20,10,0,0.7), 0 0 12px rgba(228,174,68,0.35)",
              }}
            >
              {headerLabel}
            </p>

            {content.type === "image" ? (
              <ImageVariant src={content.src} caption={content.caption} />
            ) : (
              <TextVariant
                answer={content.answer}
                reasoning={content.reasoning}
              />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ── Variant A: image + caption ─────────────────────────────────────── */
function ImageVariant({ src, caption }: { src: string; caption: string }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 md:gap-5 justify-center">
      {/* Rounded image, max ~50% of panel height so the caption always has
          breathing room beneath. object-contain preserves aspect ratio so
          the source PNG never gets squashed. */}
      <div
        className="w-full rounded-lg overflow-hidden flex items-center justify-center"
        style={{
          maxHeight: "50%",
          background: "rgba(8,5,2,0.55)",
          border: "1px solid rgba(228,207,106,0.18)",
          boxShadow:
            "0 8px 24px -10px rgba(0,0,0,0.65), inset 0 0 18px rgba(0,0,0,0.45)",
        }}
      >
        <img
          src={src}
          alt="correct answer illustration"
          className="w-full h-full object-contain rounded-md"
          draggable={false}
        />
      </div>
      <p
        className="font-sans leading-snug"
        style={{
          color: "rgba(245, 240, 220, 0.92)",
          fontSize: "clamp(15px, 2.1vmin, 20px)",
          textShadow: "0 1px 0 rgba(0,0,0,0.45)",
        }}
      >
        {caption}
      </p>
    </div>
  );
}

/* ── Variant B: large answer headline + reasoning ───────────────────── */
function TextVariant({
  answer,
  reasoning,
}: {
  answer: string;
  reasoning: string;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 justify-center">
      {/* LARGE bold answer — gold gradient stamp matching the show's
          headline treatment used on the final-result screen. Wraps if the
          answer is long (e.g. "ARMS"); collapses gracefully on narrow
          mobile widths via the clamp-driven font size. */}
      <p
        className="font-display font-bold leading-none tracking-tight break-words"
        style={{
          fontSize: "clamp(40px, 9vmin, 72px)",
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

      {/* Thin gold divider — 24px above and below per spec. Gradient fades
          to transparent at both ends so it never feels cut off. */}
      <div
        className="my-6 md:my-7 h-px w-full shrink-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(228,207,106,0.7) 30%, rgba(228,207,106,0.7) 70%, transparent 100%)",
        }}
        aria-hidden
      />

      <p
        className="font-sans leading-relaxed"
        style={{
          color: "rgba(245, 240, 220, 0.9)",
          fontSize: "clamp(14px, 2vmin, 19px)",
          textShadow: "0 1px 0 rgba(0,0,0,0.45)",
        }}
      >
        {reasoning}
      </p>
    </div>
  );
}
