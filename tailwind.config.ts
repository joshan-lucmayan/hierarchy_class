import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // New-design token set (see app/globals.css --* variables). The `text-navy`
        // utility is overridden by globals' .text-navy { color: var(--text) }.
        navy: "#464c55", // buttons / scrims (asphalt)
        slate: "#9a9ba1",
        accent: "#9ea7b3", // Great Falls accent
        faint: "#6c6d73",
        tile: "#1a1b1e",
        warn: "#c98f8f", // salmon warning text
        warnfill: "#8a5f5f", // spark low bars
        lowfill: "#5b5f66", // lowest stat fill
        sealion: "#7f8995", // fills, active border
        asphalt: "#464c55", // avatar placeholders, spark bars
        line: "#2a2b2f", // tracks, strong lines
        "line-soft": "#232327", // card hairline (var --border)
        surface: {
          50: "#17181b",
          100: "#1a1b1e",
        },
        rank: {
          splus: "#464c55",
          s: "#9ea7b3",
          a: "#e6f1fb",
          b: "#eaf3de",
          c: "#f1efe8",
          d: "#4a1f24",
        },
        rankText: {
          splus: "#9ea7b3",
          s: "#141214",
          a: "#185fa5",
          b: "#3b6d11",
          c: "#5f5e5a",
          d: "#e3b4b4",
        },
        rankBorder: {
          splus: "#9ea7b3",
          s: "#9ea7b3",
          a: "#85b7eb",
          b: "#97c459",
          c: "#b4b2a9",
          d: "#a05252",
        },
        stat: {
          academic: "#378ADD",
          physical: "#E24B4A",
          charisma: "#EF9F27",
        },
      },
    },
  },
  plugins: [],
};

export default config;
