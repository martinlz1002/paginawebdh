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
        primary: "#0f0f2a",   // fondo oscuro principal
        accent:  "#c6ff00",   // neón verde
        highlight: "#6610f2", // morado
      }
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio')
  ]
};