import type { Metadata } from "next";
import "./globals.css";
import { NarrationProvider } from "@/components/NarrationProvider";
import UiClickSound from "@/components/UiClickSound";
import UiHoverSound from "@/components/UiHoverSound";
import GoldDustField from "@/components/GoldDustField";
import { CursorGoldDust } from "@/components/MetallicText3D";
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
        {/* Warm a TCP/TLS connection to the R2 video CDN so the first
            video request (HomeIntroVideo's FullVIDF2.mp4) doesn't pay
            DNS + TLS RTT cost. preconnect is a tiny request, unlike a
            full preload which would pull a whole video file eagerly and
            steal bandwidth from the welcome video that's about to play. */}
        <link rel="preconnect" href="https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <NarrationProvider>
          <UiClickSound />
          <UiHoverSound />
          {/* Ambient gold dust drifts across every screen — gives the
              "always alive" feel without per-page wiring. */}
          <GoldDustField count={55} zIndex={5} />
          {/* Cursor-tied gold dust trail — emits short-lived gold sparks
              wherever the user moves the pointer, on every page. */}
          <CursorGoldDust />
          {children}
        </NarrationProvider>
      </body>
    </html>
  );
}
