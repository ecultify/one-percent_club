import HomeIntroVideo from "@/components/HomeIntroVideo";
import GameFlow from "@/components/GameFlow";
import AudioPrimingGate from "@/components/AudioPrimingGate";
import { ScrollScrollyProvider } from "@/contexts/ScrollScrollyContext";

export default function Home() {
  // Home page used to be a 500vh scroll-driven frame sequence
  // (ScrollyCanvas + Overlay). We now play `/questionscreenimages/Website1Fa.mp4` once
  // immediately after the user clicks "Continue with sound" on the
  // AudioPrimingGate, and surface the GameFlow "Enter" button on
  // top of the video so the user can proceed without scrolling.
  //
  // ScrollScrollyProvider is kept in place even though no ScrollyCanvas
  // writes to it — GameFlow still consumes `useScrollScrolly()` for its
  // optional dhak/theme cue logic, and the default frame index of 0 is
  // a safe no-op.
  return (
    <AudioPrimingGate>
      <ScrollScrollyProvider>
        <main className="relative w-full h-screen">
          <HomeIntroVideo />
          <GameFlow />
        </main>
      </ScrollScrollyProvider>
    </AudioPrimingGate>
  );
}
