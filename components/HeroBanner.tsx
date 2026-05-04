import { motion } from "framer-motion";
import { useAuth } from "@/context/authContext";

export default function HeroBanner() {
  const { user } = useAuth();

  const handleScroll = () => {
    const section = document.getElementById("carreras");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-dh-bg text-white">

      {/* 🌫️ GLOW */}
      <div className="absolute inset-0 -z-10 bg-dh-glow" />
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-dh-purple/6 blur-[100px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/10 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      {/* 🧿 Logo fondo */}
      <img
        src="/mi-logo.png"
        alt="DHTime"
        className="absolute w-[85%] max-w-[900px] opacity-[0.04] pointer-events-none select-none"
      />

      {/* ✨ CONTENIDO */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 text-center max-w-3xl px-6"
      >

        <h1 className="text-5xl md:text-6xl font-black leading-tight tracking-tight">
          Donde cada segundo
          <span className="block bg-gradient-to-r from-dh-purple to-dh-purpleLight bg-clip-text text-transparent">
            define la historia
          </span>
        </h1>

        <p className="mt-6 text-lg text-white/70 leading-relaxed">
          Cronometraje profesional, resultados claros y tecnología que acompaña cada meta.
        </p>

        {/* CTA */}
        <div className="mt-10 flex justify-center gap-4 flex-wrap">

          {/* 🔥 Scroll real */}
          <button
            onClick={handleScroll}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-dh-purple to-dh-purpleLight text-white font-semibold hover:scale-105 active:scale-95 transition shadow-[0_0_30px_rgba(123,47,247,0.4)]"
          >
            Ver carreras
          </button>

          {/* 🔒 Solo si NO hay sesión */}
          {!user && (
            <a
              href="/login"
              className="px-8 py-3 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition"
            >
              Iniciar sesión
            </a>
          )}

        </div>
      </motion.div>
    </section>
  );
}