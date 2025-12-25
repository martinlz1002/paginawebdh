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
          purple: "#6A1B9A",   // morado DH (ajústalo si tu logo usa otro)
          green:  "#7CC242",   // verde DH
          dark:   "#0B0B10",   // negro elegante
          ink:    "#111827",   // texto oscuro
          soft:   "#F7F7FB",   // fondo clarito
        },
      },
      boxShadow: {
        dh: "0 10px 30px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio')
  ]
};