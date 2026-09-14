import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./seo/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        // UDHARPE is a product *inside* Esytol with its own identity, so it
        // gets its own scale rather than borrowing `brand` — that blue is
        // Esytol's own, and the two have to stay distinguishable on a page
        // that shows both. Values come from the Stitch design system
        // (assets/6728907655515493824), which was itself seeded from the
        // shipping Android theme, so the web and the phone cannot drift.
        udharpe: {
          ink: "#1A1A17",
          body: "#5A5750",
          dim: "#8A867C",
          paper: "#FBFAF7",
          sunk: "#F3F1EC",
          rule: "#E4E0D8",
          primary: "#0E6F5C",
          pressed: "#0A5647",
          soft: "#E6F1EE",
          brass: "#B77B2B",
          brassSoft: "#FAF1E2",
        },
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
