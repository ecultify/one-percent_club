import type { Metadata } from "next";
import "./globals.css";
import { NarrationProvider } from "@/components/NarrationProvider";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import UiClickSound from "@/components/UiClickSound";
import UiHoverSound from "@/components/UiHoverSound";
import GoldDustField from "@/components/GoldDustField";
import { CursorGoldDust } from "@/components/MetallicText3D";
import { VideoPlaybackProvider } from "@/lib/VideoPlaybackContext";
import { PERF_FLAGS } from "@/lib/perfFlags";
import { Fraunces, Outfit, JetBrains_Mono } from "next/font/google";

const instructionsDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-inst-display",
  display: "swap",
});

const instructionsUi = Outfit({
  subsets: ["latin"],
  variable: "--font-inst-ui",
  display: "swap",
});

const instructionsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-inst-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The 1% Club",
  description: "The 1% Club interactive experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark font-sans ${instructionsDisplay.variable} ${instructionsUi.variable} ${instructionsMono.variable}`}
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <head>
        <link
          rel="preload"
          href="/sound/The%201%20Club%20Theme%20Tune%20-%20Twin%20Petes%20(1).mp3"
          as="audio"
          type="audio/mpeg"
        />
        {/* Warm the Unicorn Studio SDK CDN connection so the script
            request hits an established socket. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
{/* R2 preconnect removed — all videos are now served from same-origin
            /public via Vercel CDN. Nothing fetches from R2 anymore. */}
      </head>
      <body className="antialiased" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <NarrationProvider>
          <ConfirmProvider>
          <VideoPlaybackProvider>
          <UiClickSound />
          <UiHoverSound />
          {/* Ambient gold dust drifts across every screen — gives the
              "always alive" feel without per-page wiring. */}
          {PERF_FLAGS.particles && <GoldDustField count={55} zIndex={5} />}
          {/* Cursor-tied gold dust trail — emits short-lived gold sparks
              wherever the user moves the pointer, on every page. */}
          {PERF_FLAGS.cursorParticles && <CursorGoldDust />}
          {children}
        </VideoPlaybackProvider>
          </ConfirmProvider>
        </NarrationProvider>
      </body>
    </html>
  );
}
