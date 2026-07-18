import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0b0f2e",
        slate: "#5b6178",
        gold: "#c9962c",
        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
        },
        rank: {
          splus: "#0b0f2e",
          s: "#c9962c",
          a: "#e6f1fb",
          b: "#eaf3de",
          c: "#f1efe8",
          d: "#fcebeb",
        },
        rankText: {
          splus: "#c9962c",
          s: "#ffffff",
          a: "#185fa5",
          b: "#3b6d11",
          c: "#5f5e5a",
          d: "#a32d2d",
        },
        rankBorder: {
          splus: "#c9962c",
          s: "#c9962c",
          a: "#85b7eb",
          b: "#97c459",
          c: "#b4b2a9",
          d: "#f09595",
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
