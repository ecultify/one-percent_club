import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NarrationProvider } from "@/components/NarrationProvider";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import UiClickSound from "@/components/UiClickSound";
import UiHoverSound from "@/components/UiHoverSound";
import GoldDustField from "@/components/GoldDustField";
import { CursorGoldDust } from "@/components/MetallicText3D";
import PoweredByFooter from "@/components/PoweredByFooter";
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
  title: "India Ke Top 1%",
  description: "India Ke Top 1% — the 1% Club interactive experience.",
};

/** Game-show UI: lock the scale so iOS doesn't auto-zoom the page when an
 *  answer input (sub-16px font) gains focus, and extend into the safe areas
 *  on notched phones. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
        {/* The theme tune is NOT preloaded here: browsers block audio until a
            user gesture, so a page-load <link rel="preload" as="audio"> can't
            be "used" in time and logs a console warning. GameShowAudio fetches
            it on demand once the user interacts. */}
        {/* Warm the Unicorn Studio SDK CDN connection so the script
            request hits an established socket. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
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
          {/* Subtle, always-present studio credit — bottom of every page. */}
          <PoweredByFooter />
        </VideoPlaybackProvider>
          </ConfirmProvider>
        </NarrationProvider>
      </body>
    </html>
  );
}
