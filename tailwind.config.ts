import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        card: "var(--card)",
        border: "var(--border)",
        text: {
          primary: "var(--text-primary)",
          muted: "var(--text-muted)"
        },
        accent: {
          purple: "var(--accent-purple)",
          amber: "var(--accent-amber)",
          red: "var(--accent-red)",
          green: "var(--accent-green)"
        }
      },
      boxShadow: {
        ringSoft: "0 0 0 1px rgba(124,111,212,0.2), 0 10px 30px rgba(0,0,0,0.25)"
      },
      animation: {
        pulseSlow: "pulse 2.2s ease-in-out infinite",
        waveform: "waveform 1.2s ease-in-out infinite"
      },
      keyframes: {
        waveform: {
          "0%, 100%": { transform: "scaleY(0.45)", opacity: "0.5" },
          "50%": { transform: "scaleY(1)", opacity: "1" }
        }
      }
    }
  },
  plugins: []
};

export default config;
