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
          purple: "#6A1B9A",   // morado DH
          green:  "#7CC242",   // verde DH

          // ✅ Nuevo tema claro
          bg:     "#F3F4F6",   // gris claro principal (tipo iOS/SaaS)
          panel:  "#FFFFFF",   // tarjetas / contenedores
          border: "#E5E7EB",   // bordes suaves
          muted:  "#6B7280",   // texto secundario
          ink:    "#111827",   // texto principal (gris casi negro)

          // (opcional) si todavía ocupas un oscuro pero NO negro puro
          dark:   "#111827",
        },
      },
      boxShadow: {
        // ✅ sombras suaves para tema claro
        dh: "0 10px 25px rgba(0,0,0,0.08)",
        dhSm: "0 6px 16px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/aspect-ratio")
  ],
};