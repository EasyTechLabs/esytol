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
        // Vyora semantic design tokens (money direction, from the merchant's view).
        // Values equal the existing palette exactly — a naming layer, not a restyle.
        // positive = money coming IN (receivable / received); negative = money OUT (payable / overdue).
        positive: {
          DEFAULT: "#059669", // emerald-600
          strong: "#047857", // emerald-700 (hover / text on tint)
          tint: "#ecfdf5", // emerald-50 (selected background)
          line: "#10b981", // emerald-500 (selected border)
        },
        negative: {
          DEFAULT: "#dc2626", // red-600
          strong: "#b91c1c", // red-700
          tint: "#fef2f2", // red-50
          line: "#ef4444", // red-500
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "fade-in": "fade-in 0.25s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
