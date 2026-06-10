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
        // ─── shadcn tokens (additive; back the ui/* components) ───
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
