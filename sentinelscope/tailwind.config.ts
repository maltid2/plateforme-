import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "400px",
      },
      colors: {
        bg: "#FAF6F0",
        bg2: "#F2EBE0",
        card: "#FFFFFF",
        ink: "#1C1A17",
        muted: "#6B655C",
        line: "rgba(28,26,23,0.10)",
        acc: {
          green: "#FF7A1A",
          cyan: "#FF7A1A",
          violet: "#FF7A1A",
        },
        sev: {
          critical: "#DC2626",
          high: "#EA580C",
          medium: "#D97706",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Geist",
          "Manrope",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 24px 50px -28px rgba(0,0,0,0.22)",
        glow: "0 0 60px -12px rgba(255,122,26,0.35)",
        "glow-green": "0 0 60px -14px rgba(255,122,26,0.3)",
        "glow-cyan": "0 0 60px -14px rgba(255,122,26,0.3)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(circle at center, rgba(0,0,0,0.05), transparent 70%)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "marquee-reverse": {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        spin_slow: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "marquee-reverse": "marquee-reverse 40s linear infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 3s ease-out infinite",
        "spin-slow": "spin_slow 24s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
