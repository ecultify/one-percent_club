import type { Metadata } from "next";
import "./globals.css";
import { NarrationProvider } from "@/components/NarrationProvider";
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
  description: "Do you have what it takes to join The 1% Club?",
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
      <body className="antialiased" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <NarrationProvider>{children}</NarrationProvider>
      </body>
    </html>
  );
}
