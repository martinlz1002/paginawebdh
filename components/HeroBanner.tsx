import { motion } from "framer-motion";
import { useAuth } from "@/context/authContext";
import Link from "next/link";

export default function HeroBanner() {
  const { user } = useAuth();

  const handleScroll = () => {
    const section = document.getElementById("carreras");
    if (!section) return;

    const yOffset = -100; // Ajuste por header
    const y =
      section.getBoundingClientRect().top + window.pageYOffset + yOffset;

    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden text-white">

      {/* 🌌 FONDO MÁS AGRADABLE */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#15151c] via-[#1b1b24] to-[#15151c]" />

      {/* 🌫️ GLOW PRINCIPAL SUAVE */}
      <div className="absolute inset-0 -z-10 bg-dh-glow opacity-70" />

      {/* ✨ Glow superior (más elegante) */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-dh-purple/4 blur-[120px]" />

      {/* 🧊 Gradiente ligero */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/10 via-transparent to-transparent" />

      {/* 🧩 Textura ligera */}
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      {/* 🧿 Logo fondo */}
      <img
        src="/mi-logo.png"
        alt="DHTime"
        className="absolute w-[85%] max-w-[900px] opacity-[0.035] pointer-events-none select-none"
      />

      {/* ✨ CONTENIDO */}
      <div className="relative z-10 text-center max-w-3xl px-6">

        {/* 🧠 TITULO */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-5xl md:text-6xl font-black leading-tight tracking-tight"
        >
          Donde cada segundo

          <span className="block bg-gradient-to-r from-dh-purple to-dh-purpleLight bg-clip-text text-transparent">
            define la historia
          </span>
        </motion.h1>

        {/* ✍️ DESCRIPCIÓN */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 text-lg text-white/70 leading-relaxed"
        >
          Cronometraje profesional, resultados claros y tecnología que acompaña cada meta.
        </motion.p>

        {/* 🚀 CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex justify-center gap-4 flex-wrap"
        >

          {/* 🔥 BOTÓN PRINCIPAL */}
          <button
            onClick={handleScroll}
            className="group relative px-8 py-3 rounded-full font-semibold text-white transition-all duration-300
                       bg-gradient-to-r from-dh-purple to-dh-purpleLight
                       shadow-[0_0_25px_rgba(123,47,247,0.35)]
                       hover:scale-105 active:scale-95"
          >
            <span className="relative z-10">Ver carreras</span>

            {/* glow hover */}
            <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition
                             bg-gradient-to-r from-dh-purple to-dh-purpleLight blur-md" />
          </button>

          {/* 🔒 LOGIN SOLO SI NO HAY SESIÓN */}
          {!user && (
            <Link href="/login">
              <span className="px-8 py-3 rounded-full border border-white/20 text-white/80
                               hover:bg-white/10 hover:text-white
                               transition cursor-pointer">
                Iniciar sesión
              </span>
            </Link>
          )}

        </motion.div>
      </div>
    </section>
  );
}