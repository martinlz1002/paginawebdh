import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import HeroBanner from "@/components/HeroBanner";

type Slide =
  | {
      type: "welcome";
    }
  | {
      type: "carrera";
      id: string;
      slug?: string;
      titulo: string;
      fecha?: string;
      ubicacion?: string;
      imagenUrl?: string;
      inscripcionesAbiertas?: boolean;
    };

interface HeroSliderProps {
  carreras: any[];
}

export default function HeroSlider({ carreras }: HeroSliderProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const intervalRef = useRef<any>(null);

  const slides: Slide[] = useMemo(() => {
    const welcome = { type: "welcome" as const };

    const futuras = carreras.map((c) => ({
      type: "carrera" as const,
      id: c.id,
      slug: c.slug,
      titulo: c.titulo,
      fecha: c.fecha,
      ubicacion: c.ubicacion,
      imagenUrl: c.imagenUrl,
      inscripcionesAbiertas: c.inscripcionesAbiertas,
    }));

    return [welcome, ...futuras];
  }, [carreras]);

  useEffect(() => {
    if (slides.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(intervalRef.current);
  }, [slides.length]);

  const current = slides[index];

  const handleClick = () => {
    if (
      current.type === "carrera" &&
      current.inscripcionesAbiertas !== false
    ) {
      router.push(`/inscribirse?slug=${current.slug || current.id}`);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden">

      {/* 🌫️ GLOW GLOBAL */}
      <div className="absolute inset-0 -z-10 bg-dh-glow" />

      {/* 🔥 WELCOME */}
      {current.type === "welcome" ? (
        <>
          <HeroBanner />

          {/* Barra progreso */}
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/10 z-20">
            <motion.div
              key={index}
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 5, ease: "linear" }}
              className="h-full bg-gradient-to-r from-dh-purple to-dh-purpleLight"
            />
          </div>
        </>
      ) : (
        <>
          {/* 🖼️ BACKGROUND */}
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              {current.imagenUrl ? (
                <img
                  src={current.imagenUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-dh-gradient" />
              )}

              {/* 🎭 CAPAS DE PROFUNDIDAD */}
              <div className="absolute inset-0 bg-black/60" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent" />
            </motion.div>
          </AnimatePresence>

          {/* ✨ CONTENIDO */}
          <div className="relative z-10 min-h-screen flex items-center px-6 md:px-16">
            <div className="max-w-2xl text-white space-y-8">

              {/* Título */}
              <h2 className="text-5xl md:text-6xl font-black leading-tight">
                {current.titulo}
              </h2>

              {/* Info */}
              <div className="flex flex-wrap gap-6 text-white/70">
                {current.fecha && (
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-dh-purple" />
                    {current.fecha}
                  </span>
                )}

                {current.ubicacion && (
                  <span className="flex items-center gap-2">
                    <MapPinIcon className="w-5 h-5 text-dh-purple" />
                    {current.ubicacion}
                  </span>
                )}
              </div>

              {/* CTA */}
              {current.inscripcionesAbiertas !== false && (
                <button
                  onClick={handleClick}
                  className="mt-6 bg-gradient-to-r from-dh-purple to-dh-purpleLight text-white font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition shadow-[0_0_30px_rgba(123,47,247,0.4)]"
                >
                  Inscribirme
                </button>
              )}
            </div>
          </div>

          {/* 🔥 PROGRESS BAR */}
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/10">
            <motion.div
              key={index}
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 5, ease: "linear" }}
              className="h-full bg-gradient-to-r from-dh-purple to-dh-purpleLight"
            />
          </div>
        </>
      )}
    </section>
  );
}