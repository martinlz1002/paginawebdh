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

    bg: "#0a0a0a",
    surface: "#121212",
    panel: "#17171d",
    border: "rgba(255,255,255,0.08)",

    ink: "#ffffff",
    muted: "rgba(255,255,255,0.55)",

    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f59e0b",
  },
},

      boxShadow: {
        dh: "0 20px 50px rgba(0,0,0,0.6)",
        dhSm: "0 8px 25px rgba(0,0,0,0.45)",
        glowPurple: "0 0 40px rgba(106,27,154,0.35)",
        glowGreen: "0 0 40px rgba(124,194,66,0.35)",
      },

      backgroundImage: {
        "dh-gradient": "linear-gradient(135deg, #7B2FF7, #9b4dff)",
        "dh-radial": "radial-gradient(circle at center, rgba(106,27,154,0.25), transparent 60%)",
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },

      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [
    require("@tailwindcss/aspect-ratio")
  ],
};
