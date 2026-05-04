/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        dh: {
          purple: "#7B2FF7",
          purpleLight: "#9b4dff",
          purpleDark: "#5a1fcf",

          bg: "#141419",
          surface: "#1b1b22",
          panel: "#20202a",
          border: "rgba(255,255,255,0.08)",

          ink: "#ffffff",
          muted: "rgba(255,255,255,0.55)",

          success: "#22c55e",
          danger: "#ef4444",
          warning: "#f59e0b",
        },
      },

      boxShadow: {
        dh: "0 20px 60px rgba(0,0,0,0.6)",
        dhSoft: "0 10px 30px rgba(0,0,0,0.4)",
        glowPurple: "0 0 30px rgba(123,47,247,0.25)",
      },

      backgroundImage: {
        "dh-gradient": "linear-gradient(135deg, #7B2FF7, #9b4dff)",
        "dh-radial": "radial-gradient(circle at center, rgba(123,47,247,0.25), transparent 60%)",
        "dh-glow": "radial-gradient(circle at top, rgba(123,47,247,0.15), transparent 70%)",
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },

      backdropBlur: {
        xs: "2px",
      },

      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },

      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/aspect-ratio")
  ],
};