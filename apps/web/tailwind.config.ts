import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe3fe",
          300: "#93d1fd",
          400: "#60b5fa",
          500: "#3b95f6",
          600: "#2577eb",
          700: "#1d62d8",
          800: "#1e50af",
          900: "#1e458a",
          950: "#172b54",
        },
      },
    },
  },
  plugins: [],
};

export default config;
