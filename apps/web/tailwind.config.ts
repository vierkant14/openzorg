import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Teal primary — inspired by Intilifi, calming healthcare feel */
        brand: {
          50: "oklch(0.97 0.02 180)",
          100: "oklch(0.93 0.04 180)",
          200: "oklch(0.87 0.07 180)",
          300: "oklch(0.78 0.10 178)",
          400: "oklch(0.68 0.12 178)",
          500: "oklch(0.58 0.13 178)",
          600: "oklch(0.52 0.12 178)",
          700: "oklch(0.45 0.10 178)",
          800: "oklch(0.38 0.08 178)",
          900: "oklch(0.32 0.06 178)",
          950: "oklch(0.22 0.04 178)",
        },
        /* Deep navy secondary — authority, stability */
        navy: {
          50: "oklch(0.97 0.01 260)",
          100: "oklch(0.93 0.02 260)",
          200: "oklch(0.87 0.03 260)",
          300: "oklch(0.78 0.05 258)",
          400: "oklch(0.65 0.08 258)",
          500: "oklch(0.52 0.10 258)",
          600: "oklch(0.42 0.10 258)",
          700: "oklch(0.35 0.09 258)",
          800: "oklch(0.28 0.07 258)",
          900: "oklch(0.22 0.05 258)",
          950: "oklch(0.16 0.03 258)",
        },
        /* Warm coral accent — humanity, warmth, attention */
        coral: {
          50: "oklch(0.97 0.02 25)",
          100: "oklch(0.93 0.04 25)",
          200: "oklch(0.87 0.07 22)",
          300: "oklch(0.78 0.11 20)",
          400: "oklch(0.70 0.14 18)",
          500: "oklch(0.62 0.16 16)",
          600: "oklch(0.55 0.15 14)",
          700: "oklch(0.48 0.13 14)",
          800: "oklch(0.40 0.10 14)",
          900: "oklch(0.33 0.07 14)",
        },
        /* Warm-tinted neutrals — not cold blue-grays */
        surface: {
          0: "oklch(1.00 0.00 0)",
          50: "oklch(0.985 0.004 85)",
          100: "oklch(0.97 0.006 85)",
          200: "oklch(0.93 0.008 85)",
          300: "oklch(0.87 0.010 85)",
          400: "oklch(0.71 0.010 85)",
          500: "oklch(0.55 0.010 85)",
          600: "oklch(0.45 0.008 85)",
          700: "oklch(0.37 0.006 85)",
          800: "oklch(0.27 0.005 85)",
          900: "oklch(0.20 0.004 85)",
          950: "oklch(0.14 0.003 85)",
        },
      },
      fontFamily: {
        display: ['"Nunito"', "system-ui", "sans-serif"],
        body: ['"Source Sans 3"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(2.25rem, 2vw + 1.5rem, 3rem)", { lineHeight: "1.15", fontWeight: "800" }],
        "display-lg": ["clamp(1.75rem, 1.5vw + 1rem, 2.25rem)", { lineHeight: "1.2", fontWeight: "700" }],
        "display-md": ["1.5rem", { lineHeight: "1.25", fontWeight: "700" }],
        "heading": ["1.125rem", { lineHeight: "1.35", fontWeight: "700" }],
        "subheading": ["0.9375rem", { lineHeight: "1.4", fontWeight: "600" }],
        "body": ["0.9375rem", { lineHeight: "1.55" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }],
        "caption": ["0.75rem", { lineHeight: "1.45" }],
        "overline": ["0.6875rem", { lineHeight: "1.4", fontWeight: "600", letterSpacing: "0.04em" }],
      },
      spacing: {
        "4.5": "1.125rem",
        "18": "4.5rem",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "soft": "0 1px 3px oklch(0.20 0.005 85 / 0.06), 0 1px 2px oklch(0.20 0.005 85 / 0.04)",
        "lifted": "0 4px 12px oklch(0.20 0.005 85 / 0.08), 0 2px 4px oklch(0.20 0.005 85 / 0.04)",
        "elevated": "0 8px 24px oklch(0.20 0.005 85 / 0.10), 0 4px 8px oklch(0.20 0.005 85 / 0.06)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in": "slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
