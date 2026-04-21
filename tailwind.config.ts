import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sans: ["Arial", "Helvetica", "sans-serif"],
      display: ["Arial", "Helvetica", "sans-serif"],
      mono: ["Arial", "Helvetica", "sans-serif"],
      /** Instructions journey only — set via next/font in layout */
      "inst-display": [
        "var(--font-inst-display)",
        "Georgia",
        "ui-serif",
        "serif",
      ],
      "inst-ui": ["var(--font-inst-ui)", "system-ui", "sans-serif"],
      "inst-mono": ["var(--font-inst-mono)", "ui-monospace", "monospace"],
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--foreground-muted)",
        surface: "var(--surface)",
        "surface-light": "var(--surface-light)",
        brass: "var(--gold)",
        "brass-bright": "var(--gold-bright)",
        "brass-dim": "var(--gold-dim)",
      },
    },
  },
  plugins: [],
};
export default config;
