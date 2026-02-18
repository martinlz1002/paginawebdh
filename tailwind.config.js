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
          /* Colores marca */
          purple: "#6A1B9A",
          green: "#7CC242",

          /* Dark System */
          bg: "#0c0c0f",          // fondo principal
          surface: "#121217",     // tarjetas base
          panel: "#17171d",       // contenedores secundarios
          border: "rgba(255,255,255,0.08)",

          /* Texto */
          ink: "#ffffff",
          muted: "rgba(255,255,255,0.55)",

          /* Estados */
          success: "#7CC242",
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
        "dh-gradient": "linear-gradient(to right, #6A1B9A, #7CC242)",
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
