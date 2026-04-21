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
   - All four words use Volumetric3DText. The top three are "white" face
     (ivory + brass rim); "CLUB" is full "brass" face.
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
        {/* The "1" — hero glyph, full row height */}
        <Volumetric3DText
          face="white"
          className="font-display font-black tracking-[-0.05em]"
          style={{ fontSize: "var(--logo-scale)", lineHeight: 0.82 }}
        >
          1
        </Volumetric3DText>

        {/* Right column: THE stacked on % */}
        <div
          className="flex flex-col items-start justify-between"
          // Tight vertical rhythm so the two stack inside the "1"'s cap height.
          style={{ paddingTop: "calc(var(--logo-scale) * 0.02)" }}
        >
          <Volumetric3DText
            face="white"
            className="font-display font-black tracking-[-0.02em]"
            style={{
              fontSize: "calc(var(--logo-scale) * 0.34)",
              lineHeight: 0.88,
            }}
          >
            THE
          </Volumetric3DText>
          <Volumetric3DText
            face="white"
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

  return (
    <motion.div
      style={{ opacity, y, filter }}
      className="text-center pointer-events-auto max-w-5xl"
    >
      {/* ─── EYEBROW: Invitation only ───────────────────────────────── */}
      <p
        className="font-mono text-[10px] md:text-[11px] uppercase font-semibold mb-8"
        style={{
          color: "#e7cf6a",
          letterSpacing: "0.55em",
          textShadow: [
            "0 1px 0 rgba(20, 10, 0, 0.55)",
            "0 0 14px rgba(228, 174, 68, 0.28)",
          ].join(", "),
        }}
      >
        Invitation only
      </p>

      {/* ─── DIVIDER: thin brass bar with specular center ──────────── */}
      <div
        className="mx-auto mb-10 h-[1.5px] w-20 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(196, 160, 53, 0.4) 25%, #f4dc7c 50%, rgba(196, 160, 53, 0.4) 75%, transparent 100%)",
          boxShadow: "0 0 10px rgba(228, 174, 68, 0.45)",
        }}
      />

      {/* ─── TITLE: volumetric 3D TV-show logo ─────────────────────── */}
      <OnePercentClubLogo />

      {/* ─── SUBTITLE ───────────────────────────────────────────────── */}
      <p
        className="mt-10 max-w-md mx-auto text-base md:text-lg font-medium leading-relaxed italic"
        style={{
          color: "rgba(232, 200, 108, 0.82)",
          letterSpacing: "0.01em",
          textShadow: [
            "0 1px 0 rgba(20, 10, 0, 0.55)",
            "0 2px 0 rgba(20, 10, 0, 0.3)",
            "0 0 18px rgba(228, 174, 68, 0.18)",
          ].join(", "),
        }}
      >
        Do you have what it takes?
      </p>
    </motion.div>
  );
}
