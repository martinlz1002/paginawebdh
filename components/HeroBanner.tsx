import { motion } from "framer-motion";

export default function HeroBanner() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0c0c0f] text-white">

      {/* Fondo dinámico */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/20 via-black to-dh-green/20 blur-3xl opacity-40" />

      {/* Logo enorme sutil */}
      <img
        src="/mi-logo.png"
        alt="DHTime"
        className="absolute w-[80%] max-w-[900px] opacity-5 pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 text-center max-w-3xl px-6"
      >
        <h1 className="text-5xl md:text-6xl font-black leading-tight">
          Donde cada segundo
          <span className="block bg-gradient-to-r from-dh-purple to-dh-green bg-clip-text text-transparent">
            define la historia
          </span>
        </h1>

        <p className="mt-6 text-lg text-white/70">
          Cronometraje profesional, resultados claros y tecnología que acompaña cada meta.
        </p>
      </motion.div>
    </section>
  );
}
