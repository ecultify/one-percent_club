import ScrollyCanvas from "@/components/ScrollyCanvas";
import Overlay from "@/components/Overlay";
import GameFlow from "@/components/GameFlow";
import AudioPrimingGate from "@/components/AudioPrimingGate";
import { ScrollScrollyProvider } from "@/contexts/ScrollScrollyContext";

export default function Home() {
  return (
    <AudioPrimingGate>
      <ScrollScrollyProvider>
        <main className="relative w-full">
          <div className="relative w-full">
            <ScrollyCanvas />
            <Overlay />
          </div>
          <GameFlow />
        </main>
      </ScrollScrollyProvider>
    </AudioPrimingGate>
  );
}
