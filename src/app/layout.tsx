import type { Metadata } from "next";
import "./globals.css";
import { NarrationProvider } from "@/components/NarrationProvider";
import UiClickSound from "@/components/UiClickSound";
import UiHoverSound from "@/components/UiHoverSound";
import GoldDustField from "@/components/GoldDustField";
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
        {/* Preload the cinema-screen JSON so it's already in cache by
            the time FinalStage3D mounts. Without this the user waits on
            a cold fetch when they hit the end screen. */}
        <link
          rel="preload"
          href="/animations/intro_sequence_remix.json"
          as="fetch"
          type="application/json"
          crossOrigin="anonymous"
        />
        {/* Warm the Unicorn Studio SDK CDN connection so the script
            request hits an established socket. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <NarrationProvider>
          <UiClickSound />
          <UiHoverSound />
          {/* Ambient gold dust drifts across every screen — gives the
              "always alive" feel without per-page wiring. */}
          <GoldDustField count={55} zIndex={5} />
          {children}
        </NarrationProvider>
      </body>
    </html>
  );
}
