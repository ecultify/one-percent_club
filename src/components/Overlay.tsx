"use client";

import { motion, useScroll, useTransform } from "framer-motion";

export default function Overlay() {
  return (
    <div className="pointer-events-none absolute top-0 left-0 z-10 h-[500vh] w-full">
      {/* Hero — first screen copy only (scroll sections for "test your knowledge" / "stakes" removed) */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-6">
        <TextSection start={0} end={0.15} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   VOLUMETRIC 3D BRASS TYPE — ztext-style layered clones, static tilt,
   metallic shine sweep on the front face.
   ────────────────────────────────────────────────────────────────────────────
   DEPTH
   -----
   18 cloned <span> layers stacked via translateZ() inside a preserve-3d
   parent. Back layers ramp from deep bronze/brass to muted brass; front
   face has the final colour treatment.

   FACE VARIANTS
   -------------
   - "brass" : front face uses the polished brass gradient (for CLUB and
     any word that should feel like a solid gold casting).
   - "white" : front face is warm ivory with a brass text-stroke, side
     walls ramp in brass only (not bronze). Matches the TV-show treatment
     of THE / 1 / % — ivory face with a golden bevel pouring down the
     letter walls.

   TILT (the "we can see it's 3D" move)
   ------------------------------------
   Static `rotateX(-10deg)` with `transform-origin: 50% 100%` so the text
   pivots from its bottom edge. Top leans back into the screen, revealing
   the top face of the extruded volume. No pointer interaction.

   SHINE (the "it's metal, not paint" move)
   ----------------------------------------
   A diagonal bright-band gradient sits at translateZ(+0.6px) — i.e. just
   in front of the front face. The band is masked to the text shape via
   background-clip, blended with screen, and its background-position is
   animated on a 5.5s loop so the specular highlight sweeps across the
   letters like light raking over polished metal.
   ──────────────────────────────────────────────────────────────────────── */

const DEPTH_LAYERS = 20;
const LAYER_STEP = 1.6;

// Same 8-stop polished brass used on .metallic-chip, A/B/C/D badges, etc.
const BRASS_GRADIENT = `linear-gradient(180deg,
  #6d4e13 0%,
  #9c7819 7%,
  #c99d2e 18%,
  #e8c458 30%,
  #f7e092 42%,
  #fff4bf 50%,
  #f4dc7c 58%,
  #d9b446 70%,
  #9c7819 86%,
  #5c3e0d 100%
)`;

/** Side-wall colour at depth t (0 = deepest, 1 = just behind front). */
function rampBronze(t: number) {
  // Dark bronze at the back, warming to mid brass near the front.
  const l = 6 + (26 - 6) * t;
  return `hsl(38, 64%, ${l}%)`;
}

function rampBrassSide(t: number) {
  // Stays golden throughout — back is muted mustard, front is bright brass.
  // Used for the ivory-faced characters so the side walls glow gold.
  const l = 16 + (52 - 16) * t;
  return `hsl(42, 74%, ${l}%)`;
}

type FaceVariant = "brass" | "white";

function Volumetric3DText({
  children,
  className,
  style,
  face = "brass",
}: {
  children: string;
  className?: string;
  style?: React.CSSProperties;
  face?: FaceVariant;
}) {
  const sideRamp = face === "white" ? rampBrassSide : rampBronze;

  return (
    <span
      className="relative inline-block"
      style={{
        perspective: "900px",
        perspectiveOrigin: "50% 65%",
        ...style,
      }}
    >
      <span
        className="relative inline-block"
        style={{
          transformStyle: "preserve-3d",
          // Static tilt — top leans back, revealing the top face of the
          // extruded volume. Pivot anchored at the bottom edge.
          transform: "rotateX(-10deg)",
          transformOrigin: "50% 100%",
        }}
      >
        {/* ─── DEPTH LAYERS (0 = deepest, last = front face) ─── */}
        {Array.from({ length: DEPTH_LAYERS }).map((_, i) => {
          const isFront = i === DEPTH_LAYERS - 1;
          const z = (i - DEPTH_LAYERS + 1) * LAYER_STEP;
          const t = i / (DEPTH_LAYERS - 1);

          const spanStyle: React.CSSProperties = {
            transform: `translateZ(${z}px)`,
            whiteSpace: "nowrap",
          };

          if (isFront) {
            if (face === "white") {
              // IVORY FRONT — warm white face, thin brass text-stroke to
              // create the visible bevel rim seen in the TV-show logo.
              spanStyle.color = "#fbf3d8";
              spanStyle.WebkitTextStroke = "2.5px #a6801f";
              spanStyle.filter = [
                "drop-shadow(0 0 36px rgba(228, 174, 68, 0.4))",
                "drop-shadow(0 20px 32px rgba(0, 0, 0, 0.6))",
                "drop-shadow(0 1px 0 rgba(20, 10, 0, 0.85))",
              ].join(" ");
            } else {
              // BRASS FRONT — polished brass gradient + warm halo + floor shadow.
              spanStyle.background = BRASS_GRADIENT;
              spanStyle.WebkitBackgroundClip = "text";
              spanStyle.backgroundClip = "text";
              spanStyle.WebkitTextFillColor = "transparent";
              spanStyle.color = "transparent";
              spanStyle.filter = [
                "drop-shadow(0 0 42px rgba(228, 174, 68, 0.45))",
                "drop-shadow(0 22px 36px rgba(0, 0, 0, 0.6))",
                "drop-shadow(0 1px 0 rgba(20, 10, 0, 0.9))",
              ].join(" ");
            }
          } else {
            // SIDE-WALL LAYER — solid ramp colour.
            spanStyle.position = "absolute";
            spanStyle.inset = 0;
            spanStyle.color = sideRamp(t);
            // Slight blur on the deepest layers fakes atmospheric depth.
            if (t < 0.3) spanStyle.filter = "blur(0.4px)";
          }

          return (
            <span
              key={i}
              aria-hidden="true"
              className={className}
              style={spanStyle}
            >
              {children}
            </span>
          );
        })}

        {/* ─── METALLIC SHINE SWEEP ──────────────────────────────────
            Sits at translateZ(+0.6px) — just in front of the front face
            so it layers ON the polished brass/ivory. The diagonal bright
            band scrolls across via background-position animation, masked
            to the text shape via background-clip. Blended with screen so
            it adds light to the face below, never dims it. */}
        <span
          aria-hidden="true"
          className={`${className ?? ""} overlay-shine-sweep pointer-events-none`}
          style={{
            position: "absolute",
            inset: 0,
            transform: "translateZ(0.6px)",
            whiteSpace: "nowrap",
            background:
              "linear-gradient(115deg, transparent 0%, transparent 36%, rgba(255, 250, 220, 0.95) 48%, rgba(255, 255, 255, 0.75) 50%, rgba(255, 250, 220, 0.95) 52%, transparent 64%, transparent 100%)",
            backgroundSize: "250% 100%",
            backgroundRepeat: "no-repeat",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            mixBlendMode: "screen",
          }}
        >
          {children}
        </span>
      </span>
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   ONE-PERCENT-CLUB LOGO
   ────────────────────────────────────────────────────────────────────────────
   Replicates the TV-show mark layout:

       ┌─────┬─────┐
       │     │ THE │
       │  1  │     │
       │     │  %  │
       └─────┴─────┘
       ┌───────────┐
       │   CLUB    │
       └───────────┘

   - The "1" is the dominant form, taking the full height of the top row.
   - "THE" sits top-right, smaller. "%" sits bottom-right of the same column,
     slightly larger than "THE", together filling the height of the "1".
   - "CLUB" drops below and spans the width underneath.
   - The "1" uses "white" face (bright core glow); "THE", "%", and "CLUB" use
     full "brass" — polished gold extrusion like the broadcast mark.
   ──────────────────────────────────────────────────────────────────────── */

function OnePercentClubLogo() {
  return (
    <div
      aria-label="The 1% Club"
      role="img"
      className="inline-flex flex-col items-center leading-none select-none"
      // Sizes cascade from --logo-scale. Tuned so the whole mark comfortably
      // fills a 1024px hero at desktop while scaling down to mobile.
      style={{
        ["--logo-scale" as string]: "clamp(4rem, 18vw, 13.5rem)",
      }}
    >
      {/* ─── TOP ROW: 1 + (THE / %) stack ─────────────────────────────── */}
      <div
        className="flex items-stretch"
        style={{ gap: "calc(var(--logo-scale) * 0.06)" }}
      >
        {/* The "1" — hero glyph, full row height; radial bloom reads as the light source */}
        <div className="relative inline-flex shrink-0 items-center self-stretch">
          <div
            className="pointer-events-none absolute left-1/2 top-[46%] -z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "calc(var(--logo-scale) * 0.52)",
              height: "calc(var(--logo-scale) * 0.88)",
              background:
                "radial-gradient(ellipse 50% 48% at 50% 50%, rgba(255,255,255,0.92) 0%, rgba(255,235,200,0.45) 28%, rgba(255,200,120,0.2) 48%, transparent 72%)",
              filter: "blur(calc(var(--logo-scale) * 0.11))",
              mixBlendMode: "screen",
            }}
            aria-hidden
          />
          <Volumetric3DText
            face="white"
            className="font-display font-black tracking-[-0.05em]"
            style={{ fontSize: "var(--logo-scale)", lineHeight: 0.82 }}
          >
            1
          </Volumetric3DText>
        </div>

        {/* Right column: THE stacked on % */}
        <div
          className="flex flex-col items-start justify-between"
          // Tight vertical rhythm so the two stack inside the "1"'s cap height.
          style={{ paddingTop: "calc(var(--logo-scale) * 0.02)" }}
        >
          <Volumetric3DText
            face="brass"
            className="font-display font-black tracking-[-0.02em]"
            style={{
              fontSize: "calc(var(--logo-scale) * 0.34)",
              lineHeight: 0.88,
            }}
          >
            THE
          </Volumetric3DText>
          <Volumetric3DText
            face="brass"
            className="font-display font-black tracking-[-0.03em]"
            style={{
              fontSize: "calc(var(--logo-scale) * 0.58)",
              lineHeight: 0.85,
              marginTop: "calc(var(--logo-scale) * -0.02)",
            }}
          >
            %
          </Volumetric3DText>
        </div>
      </div>

      {/* ─── BOTTOM ROW: CLUB — full brass ─────────────────────────────── */}
      <Volumetric3DText
        face="brass"
        className="font-display font-black tracking-[-0.02em]"
        style={{
          fontSize: "calc(var(--logo-scale) * 0.62)",
          lineHeight: 0.9,
          marginTop: "calc(var(--logo-scale) * 0.04)",
        }}
      >
        CLUB
      </Volumetric3DText>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function TextSection({
  start,
  end,
}: {
  start: number;
  end: number;
}) {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [start, end], [1, 0]);
  const y = useTransform(scrollYProgress, [start, end], [0, -48]);
  const blurPx = useTransform(scrollYProgress, [start, end], [0, 10]);
  const filter = useTransform(blurPx, (b) => `blur(${b}px)`);

  const legibleEyebrow = {
    color: "#fff8e8",
    letterSpacing: "0.42em",
    textShadow: [
      "0 0 2px rgba(0,0,0,1)",
      "0 2px 12px rgba(0,0,0,0.95)",
      "0 0 28px rgba(228, 190, 90, 0.65)",
      "0 1px 0 rgba(0,0,0,0.9)",
    ].join(", "),
  } as const;

  const legibleTagline = {
    color: "#fff4d4",
    textShadow: [
      "0 0 2px rgba(0,0,0,1)",
      "0 2px 14px rgba(0,0,0,0.92)",
      "0 0 36px rgba(255, 190, 80, 0.4)",
    ].join(", "),
  } as const;

  return (
    <motion.div
      style={{ opacity, y, filter }}
      className="text-center pointer-events-auto max-w-5xl px-4"
    >
      <p
        className="font-mono text-[11px] font-bold uppercase sm:text-xs md:text-[13px] mb-6 md:mb-8"
        style={legibleEyebrow}
      >
        Invitation only
      </p>

      <div
        className="mx-auto mb-6 h-[2px] w-24 rounded-full sm:mb-8 sm:w-28 md:mb-10"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,230,160,0.35) 15%, #ffe8a0 50%, rgba(255,230,160,0.35) 85%, transparent 100%)",
          boxShadow:
            "0 0 14px rgba(255, 220, 140, 0.85), 0 0 2px rgba(0,0,0,0.9)",
        }}
        aria-hidden
      />

      <OnePercentClubLogo />

      <p
        className="mt-7 max-w-xl mx-auto text-[13px] font-bold uppercase leading-snug tracking-[0.14em] text-balance sm:mt-9 sm:text-[15px] sm:tracking-[0.16em] md:mt-10 md:text-lg md:tracking-[0.18em]"
        style={legibleTagline}
      >
        Do you have what it takes?
      </p>

      <motion.button
        type="button"
        onClick={() =>
          window.scrollBy({
            top: Math.max(140, window.innerHeight * 0.22),
            behavior: "smooth",
          })
        }
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 sm:mt-7 md:mt-8 mx-auto flex flex-col items-center gap-1.5 rounded-full px-4 py-2.5 sm:px-5 sm:py-3 cursor-pointer touch-manipulation"
        style={{
          background:
            "linear-gradient(180deg, #fff6d2 0%, #f0d56e 18%, #d4a82a 45%, #a67a18 72%, #6b4a0c 100%)",
          boxShadow:
            "0 10px 28px -10px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,252,230,0.9), inset 0 -2px 6px rgba(40,22,0,0.35)",
        }}
        aria-label="Scroll down to continue"
      >
        <span
          className="font-mono text-[9px] font-bold uppercase tracking-[0.28em] sm:text-[10px] sm:tracking-[0.32em]"
          style={{
            color: "#2a1a04",
            textShadow: "0 1px 0 rgba(255,250,220,0.65)",
          }}
        >
          Scroll down
        </span>
        <motion.span
          aria-hidden
          className="flex items-center justify-center"
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0a0a0a"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 13l7 7 7-7" />
          </svg>
        </motion.span>
      </motion.button>
    </motion.div>
  );
}
