import HomeIntroVideo from "@/components/HomeIntroVideo";
import GameFlow from "@/components/GameFlow";
import AudioPrimingGate from "@/components/AudioPrimingGate";
import LiveQuizNav from "@/components/live/LiveQuizNav";
import { ScrollScrollyProvider } from "@/contexts/ScrollScrollyContext";
import { PERF_FLAGS } from "@/lib/perfFlags";

// ─── DEV-ONLY: ?devq= quick-jump (REMOVE BEFORE PROD) ───
type HomeSearchParams = { devq?: string | string[] };
function isDevJump(searchParams?: HomeSearchParams): boolean {
  const raw = Array.isArray(searchParams?.devq) ? searchParams?.devq[0] : searchParams?.devq;
  if (!raw) return false;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1;
}
// ─── END DEV-ONLY ───

export default function Home({ searchParams }: { searchParams?: HomeSearchParams }) {
  // Home page used to be a 500vh scroll-driven frame sequence
  // (ScrollyCanvas + Overlay). We now play the home intro video once
  // immediately after the user clicks "Continue with sound" on the
  // AudioPrimingGate, and surface the GameFlow "Enter" button on top
  // of the video so the user can proceed without scrolling.
  //
  // ScrollScrollyProvider is kept in place even though no ScrollyCanvas
  // writes to it — GameFlow still consumes useScrollScrolly() for its
  // optional dhak/theme cue logic, and the default frame index of 0 is
  // a safe no-op.
  // ─── DEV-ONLY: ?devq= quick-jump (REMOVE BEFORE PROD) ───
  // When ?devq=N is set, GameFlow fast-forwards through the idle/welcome
  // flow straight into QuizGame at the requested question. Skip the
  // background HomeIntroVideo entirely so its dhak.wav stinger and theme
  // cue do not fire underneath the question screen.
  const devJump = isDevJump(searchParams);
  // ─── END DEV-ONLY ───
  return (
    <AudioPrimingGate>
      <ScrollScrollyProvider>
        <main className="relative w-full h-screen">
          {/* LIVE-QUIZ REFACTOR: the landing HomeIntroVideo (FullVIDF2 +
              LastVid2 loop) and the GameFlow welcome teaser are the only
              two videos that still play. All q1–q10 intro / reaction /
              final videos remain commented out via PERF_FLAGS.liveQuizMode. */}
          {!devJump && PERF_FLAGS.backgroundVideo && <HomeIntroVideo />}
          <GameFlow />
          {PERF_FLAGS.liveQuizMode && <LiveQuizNav />}
        </main>
      </ScrollScrollyProvider>
    </AudioPrimingGate>
  );
}
