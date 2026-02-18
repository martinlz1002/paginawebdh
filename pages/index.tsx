import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion } from "framer-motion";
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
    <div className="bg-[#0c0c0f] text-white overflow-hidden">

      {/* HERO FULLSCREEN */}
      <section className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-dh-purple via-black to-dh-green" />
        <div className="relative z-10 w-full">
          <HeroSlider carreras={carreras} />
        </div>
      </section>

      {/* BUSCADOR */}
      <section className="relative py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto bg-[#141418] border border-white/10 rounded-3xl p-10"
        >
          <SearchCard />
        </motion.div>
      </section>

      {/* RESULTADOS */}
      {resultadosRecientes.length > 0 && (
        <section className="py-20 border-t border-white/10">
          <div className="px-6">
            <h2 className="text-3xl font-bold mb-12 flex items-center gap-3">
              <TrophyIcon className="w-6 h-6 text-dh-green" />
              Últimos resultados
            </h2>

            <div className="flex gap-6 overflow-x-auto pb-4">
              {resultadosRecientes.map((r) => (
                <motion.a
                  key={r.id}
                  href={r.resultados!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  className="min-w-[280px] bg-[#1b1b22] p-6 rounded-2xl border border-white/10"
                >
                  <p className="font-semibold">{r.titulo}</p>
                  <span className="text-sm text-dh-green">
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
          Próximas <span className="text-dh-green">Carreras</span>
        </h2>

        <div className="space-y-16 max-w-6xl mx-auto">
          {carreras.map((c, i) => {
            const abiertas = c.inscripcionesAbiertas !== false;

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: i % 2 === 0 ? -100 : 100 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="flex flex-col md:flex-row items-center gap-10"
              >
                <div className="flex-1">
                  {c.imagenUrl && (
                    <img
                      src={c.imagenUrl}
                      alt={c.titulo}
                      className="rounded-3xl w-full h-80 object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 space-y-6">
                  <h3 className="text-3xl font-bold">{c.titulo}</h3>

                  <div className="flex gap-6 text-white/70">
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      {c.fecha}
                    </span>
                    {c.ubicacion && (
                      <span className="flex items-center gap-2">
                        <MapPinIcon className="w-5 h-5" />
                        {c.ubicacion}
                      </span>
                    )}
                  </div>

                  {abiertas ? (
                    <Link href={`/inscribirse?carreraId=${c.id}`}>
                      <span className="inline-flex items-center gap-2 bg-dh-green text-black font-bold px-6 py-3 rounded-full cursor-pointer hover:scale-105 transition">
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
    </div>
  );
}
