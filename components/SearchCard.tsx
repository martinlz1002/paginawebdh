import { useState, useEffect } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  CalendarIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

interface Carrera {
  id: string;
  titulo: string;
  ubicacion?: string;
  fecha: string; // formato "DD/MM/YYYY"
}

export default function SearchCard() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [filtered, setFiltered] = useState<Carrera[]>([]);

  // 1️⃣ Cargo todas las carreras
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));
      const lista = snap.docs.map((d) => {
        const c = d.data() as any;

        // ✅ aquí leo c.lugar (no c.ubicacion)
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
        } as Carrera;
      });

      setCarreras(lista);
    })();
  }, []);

  // 2️⃣ Filtro en vivo cada vez que cambian q, city o date
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

  const inputBase =
    "w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white text-gray-900 placeholder-gray-400 " +
    "border-dh-purple/15 focus:outline-none focus:ring-2 focus:ring-dh-green/40 focus:border-dh-green/40";

  return (
    <div className="relative max-w-4xl mx-auto bg-white rounded-2xl shadow-dh p-6 space-y-4 border border-dh-purple/10">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-dh-ink">
          Encuentra tu carrera{" "}
          <span className="text-dh-purple">en segundos</span>
        </h3>
        <span className="hidden sm:inline text-xs text-gray-500">
          Filtra por nombre, ciudad o fecha
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Input texto */}
        <div className="relative md:col-span-2">
          <MagnifyingGlassIcon className="w-5 h-5 text-dh-purple/60 absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar carrera..."
            className={inputBase}
          />
        </div>

        {/* Input ciudad */}
        <div className="relative">
          <MapPinIcon className="w-5 h-5 text-dh-purple/60 absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ciudad"
            className={inputBase}
          />
        </div>

        {/* Input fecha */}
        <div className="relative md:col-span-1">
          <CalendarIcon className="w-5 h-5 text-dh-purple/60 absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputBase}
          />
        </div>
      </div>

      {/* Resultados filtrados */}
      {(q || city || date) && (
        <ul className="mt-2 max-h-64 overflow-auto rounded-2xl border border-dh-purple/10 bg-white">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <li key={c.id} className="border-b last:border-b-0 border-dh-purple/10">
                <Link href={`/inscribirse?carreraId=${c.id}`}>
                  <a className="flex justify-between items-center px-4 py-3 hover:bg-dh-soft transition">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {c.titulo}
                      </p>
                      {c.ubicacion ? (
                        <p className="text-xs text-gray-500 truncate">{c.ubicacion}</p>
                      ) : null}
                    </div>
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      {c.fecha}
                    </span>
                  </a>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-gray-500">No se encontraron carreras.</li>
          )}
        </ul>
      )}
    </div>
  );
}