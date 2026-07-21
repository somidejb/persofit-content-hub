import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "#0a0a0a",
          50: "#141414",
          100: "#181818",
          200: "#1f1f1f",
          300: "#262626",
          border: "#232323",
        },
        neon: {
          DEFAULT: "#00FF87",
          dim: "#00cc6c",
          glow: "#00FF87",
        },
      },
      boxShadow: {
        neon: "0 0 20px -4px rgba(0,255,135,0.35)",
        "neon-sm": "0 0 10px -2px rgba(0,255,135,0.4)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
