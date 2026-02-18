import { useState, useEffect } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface Carrera {
  id: string;
  titulo: string;
  ubicacion?: string;
  fecha: string;
}

export default function SearchCard() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [filtered, setFiltered] = useState<Carrera[]>([]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));
      const lista = snap.docs.map((d) => {
        const c = d.data() as any;
        const ubicacion = c.lugar || c.ubicacion || "";

        let fechaStr = "";
        if (c.fecha instanceof Timestamp) {
          fechaStr = c.fecha.toDate().toLocaleDateString("es-MX");
        } else {
          fechaStr = new Date(c.fecha).toLocaleDateString("es-MX");
        }

        return {
          id: d.id,
          titulo: c.titulo,
          ubicacion,
          fecha: fechaStr,
        };
      });

      setCarreras(lista);
    })();
  }, []);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    const cityTerm = city.trim().toLowerCase();
    const dateTerm = date ? new Date(date).toLocaleDateString("es-MX") : "";

    setFiltered(
      carreras.filter((c) => {
        const matchText = term === "" || c.titulo.toLowerCase().includes(term);
        const matchCity =
          cityTerm === "" || (c.ubicacion || "").toLowerCase().includes(cityTerm);
        const matchDate = dateTerm === "" || c.fecha === dateTerm;
        return matchText && matchCity && matchDate;
      })
    );
  }, [q, city, date, carreras]);

  const hasFilters = Boolean(q || city || date);

  const clearAll = () => {
    setQ("");
    setCity("");
    setDate("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="relative w-full max-w-5xl mx-auto"
    >
      {/* Contenedor glass oscuro */}
      <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-white">
            Busca tu próxima carrera
          </h3>

          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
            >
              <XMarkIcon className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>

        {/* Inputs estilo command */}
        <div className="grid md:grid-cols-3 gap-4">

          {/* Buscar */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Nombre de la carrera"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-green/50 transition"
            />
          </div>

          {/* Ciudad */}
          <div className="relative">
            <MapPinIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Ciudad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-green/50 transition"
            />
          </div>

          {/* Fecha */}
          <div className="relative">
            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-dh-green/50 transition"
            />
          </div>
        </div>

        {/* Resultados */}
        <AnimatePresence>
          {hasFilters && (
            <motion.ul
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 rounded-2xl bg-black/40 border border-white/10 overflow-hidden"
            >
              {filtered.length > 0 ? (
                filtered.map((c) => (
                  <li key={c.id} className="border-b border-white/10 last:border-none">
                    <Link href={`/inscribirse?carreraId=${c.id}`}>
                      <span className="flex justify-between items-center px-6 py-4 hover:bg-white/5 transition cursor-pointer">
                        <div>
                          <p className="text-white font-semibold">
                            {c.titulo}
                          </p>
                          {c.ubicacion && (
                            <p className="text-xs text-white/50">
                              {c.ubicacion}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-white/60">
                          {c.fecha}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="px-6 py-4 text-white/50">
                  No se encontraron carreras.
                </li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}
