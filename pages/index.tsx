import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion } from "framer-motion";
import Gallery from "@/components/Gallery";
import {
  CalendarIcon,
  MapPinIcon,
  ArrowRightIcon,
  LockClosedIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

import HeroSlider from "@/components/HeroSlider";
import SearchCard from "@/components/SearchCard";

interface Carrera {
  id: string;
  slug?: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: string;
  imagenUrl?: string;
  inscripcionesAbiertas?: boolean;
  inscripcionesMensaje?: string;
  resultados?: {
    url?: string;
    publicado?: boolean;
  };
  carreraDate?: Date;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function HomePage() {
  const router = useRouter();
  const { titulo: qTitulo, ubicacion: qCiudad, fecha: qFecha } = router.query;

  const [raw, setRaw] = useState<Carrera[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);

  useEffect(() => {
    (async () => {
      const snapshot = await getDocs(collection(db, "carreras"));

      const data = snapshot.docs
        .map((docu) => {
          const c = docu.data() as any;

          let fechaFormateada = "";
          let carreraDate: Date | null = null;

          if (c.fecha instanceof Timestamp) {
            const dt = c.fecha.toDate();
            carreraDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
            fechaFormateada = `${pad(carreraDate.getDate())}/${pad(
              carreraDate.getMonth() + 1
            )}/${carreraDate.getFullYear()}`;
          } else if (typeof c.fecha === "string") {
            const [y, m, d] = c.fecha.split("-").map(Number);
            carreraDate = new Date(y, m - 1, d);
            fechaFormateada = `${pad(d)}/${pad(m)}/${y}`;
          }

          return {
            id: docu.id,
            slug: c.slug || "",
            titulo: c.titulo || "(sin título)",
            descripcion: c.descripcion || "",
            ubicacion: c.lugar || c.ubicacion || "",
            fecha: fechaFormateada,
            imagenUrl: c.imagenUrl || "",
            inscripcionesAbiertas: c.inscripcionesAbiertas !== false,
            inscripcionesMensaje: c.inscripcionesMensaje || "",
            resultados: c.resultados || null,
            carreraDate,
          } as Carrera & { carreraDate: Date | null };
        })
        .filter(
          (c): c is Carrera & { carreraDate: Date } =>
            c.carreraDate !== null
        );

      setRaw(data);
    })();
  }, []);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = raw.filter(
      (c) => c.carreraDate && c.carreraDate >= today
    );

    if (typeof qTitulo === "string" && qTitulo.trim()) {
      const needle = qTitulo.toLowerCase();
      filtered = filtered.filter((c) =>
        c.titulo.toLowerCase().includes(needle)
      );
    }

    if (typeof qCiudad === "string" && qCiudad.trim()) {
      const needle = qCiudad.toLowerCase();
      filtered = filtered.filter((c) =>
        (c.ubicacion || "").toLowerCase().includes(needle)
      );
    }

    if (typeof qFecha === "string" && qFecha.trim()) {
      filtered = filtered.filter((c) => c.fecha === qFecha);
    }

    filtered = filtered.sort(
      (a, b) =>
        (a.carreraDate?.getTime() ?? 0) -
        (b.carreraDate?.getTime() ?? 0)
    );

    setCarreras(filtered);
  }, [raw, qTitulo, qCiudad, qFecha]);

  // 🔥 FILTRO CORREGIDO Y MÁS ROBUSTO
  const resultadosRecientes = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return raw
      .filter((c) => {
        const esPasada =
          c.carreraDate && c.carreraDate < today;

        const tieneResultados =
          c.resultados &&
          c.resultados.url &&
          String(c.resultados.url).trim().length > 0 &&
          c.resultados.publicado === true;

        return esPasada && tieneResultados;
      })
      .sort(
        (a, b) =>
          (b.carreraDate?.getTime() ?? 0) -
          (a.carreraDate?.getTime() ?? 0)
      )
      .slice(0, 4);
  }, [raw]);

  return (
  <div className="relative bg-dh-bg text-white overflow-hidden">

    {/* 🌫️ GLOW GLOBAL (clave total) */}
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-dh-purple/10 blur-[120px]" />
    </div>

    {/* HERO FULLSCREEN */}
    <section className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-dh-purple/40 via-transparent to-black" />
      
      <div className="relative z-10 w-full">
        <HeroSlider carreras={carreras} />
      </div>
    </section>

    {/* BUSCADOR */}
    <section className="relative py-28 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto bg-dh-surface border border-white/5 rounded-3xl p-10 shadow-dh"
      >
        <SearchCard />
      </motion.div>
    </section>

    {/* RESULTADOS */}
    {resultadosRecientes.length > 0 && (
      <section className="py-24 border-t border-white/5">
        <div className="px-6 max-w-6xl mx-auto">

          <h2 className="text-3xl font-bold mb-12 flex items-center gap-3">
            <TrophyIcon className="w-6 h-6 text-dh-purple" />
            Últimos resultados
          </h2>

          <div className="flex gap-6 overflow-x-auto pb-4">
            {resultadosRecientes.map((r) => (
              <motion.a
                key={r.id}
                href={r.resultados!.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.04 }}
                className="min-w-[280px] bg-dh-panel p-6 rounded-2xl border border-white/5 shadow-dhSoft transition"
              >
                <p className="font-semibold text-white/90">{r.titulo}</p>

                <span className="text-sm text-dh-purple mt-2 inline-block">
                  Ver resultados →
                </span>
              </motion.a>
            ))}
          </div>

        </div>
      </section>
    )}

    {/* PRÓXIMAS CARRERAS */}
    <section className="py-32 px-6">
      <h2 className="text-5xl font-black mb-20 text-center">
        Próximas <span className="text-dh-purple">Carreras</span>
      </h2>

      <div className="space-y-20 max-w-6xl mx-auto">
        {carreras.map((c, i) => {
          const abiertas = c.inscripcionesAbiertas !== false;

          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: i % 2 === 0 ? -80 : 80 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="flex flex-col md:flex-row items-center gap-12"
            >
              {/* IMAGEN */}
              <div className="flex-1">
                {c.imagenUrl && (
                  <img
                    src={c.imagenUrl}
                    alt={c.titulo}
                    className="rounded-3xl w-full h-80 object-cover shadow-dhSoft"
                  />
                )}
              </div>

              {/* INFO */}
              <div className="flex-1 space-y-6">
                <h3 className="text-3xl font-bold text-white/95">
                  {c.titulo}
                </h3>

                <div className="flex gap-6 text-white/60">
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-dh-purple" />
                    {c.fecha}
                  </span>

                  {c.ubicacion && (
                    <span className="flex items-center gap-2">
                      <MapPinIcon className="w-5 h-5 text-dh-purple" />
                      {c.ubicacion}
                    </span>
                  )}
                </div>

                {/* CTA */}
                {abiertas ? (
                  <Link href={`/inscribirse?slug=${c.slug || c.id}`}>
                    <span className="inline-flex items-center gap-2 bg-gradient-to-r from-dh-purple to-dh-purpleLight text-white font-bold px-7 py-3 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition shadow-[0_0_20px_rgba(123,47,247,0.35)]">
                      Inscribirme
                      <ArrowRightIcon className="w-5 h-5" />
                    </span>
                  </Link>
                ) : (
                  <div className="inline-flex items-center gap-2 text-red-400">
                    <LockClosedIcon className="w-5 h-5" />
                    Inscripciones pausadas
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>

    {/* GALERÍA */}
    <section className="py-28 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <Gallery limit={6} showAllButton />
      </div>
    </section>

  </div>
);
}