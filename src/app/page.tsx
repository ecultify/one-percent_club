import ScrollyCanvas from "@/components/ScrollyCanvas";
import Overlay from "@/components/Overlay";
import GameFlow from "@/components/GameFlow";

export default function Home() {
  return (
    <main className="relative w-full">
      <div className="relative w-full">
        <ScrollyCanvas />
        <Overlay />
      </div>
      <GameFlow />
    </main>
  );
}
