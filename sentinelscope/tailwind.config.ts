import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "400px",
      },
      colors: {
        bg: "#07090D",
        bg2: "#0D1118",
        card: "#121821",
        ink: "#F5F7FA",
        muted: "#8B98A8",
        line: "rgba(255,255,255,0.08)",
        acc: {
          green: "#8D7CFF",
          cyan: "#8D7CFF",
          violet: "#8D7CFF",
        },
        sev: {
          critical: "#F4576B",
          high: "#FF9715",
          medium: "#F5C451",
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
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 20px 60px -30px rgba(0,0,0,0.8)",
        glow: "0 0 60px -12px rgba(141,124,255,0.45)",
        "glow-green": "0 0 60px -14px rgba(141,124,255,0.4)",
        "glow-cyan": "0 0 60px -14px rgba(141,124,255,0.4)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(circle at center, rgba(255,255,255,0.06), transparent 70%)",
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
