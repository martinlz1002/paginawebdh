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

  // Carga todas las carreras al montar
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));
      const lista = snap.docs.map((d) => {
        const c = d.data() as any;
        let fechaStr = "";
        if (c.fecha instanceof Timestamp) {
          const dt = c.fecha.toDate();
          fechaStr = dt.toLocaleDateString("es-MX");
        } else {
          fechaStr = new Date(c.fecha).toLocaleDateString("es-MX");
        }
        return {
          id: d.id,
          titulo: c.titulo,
          ubicacion: c.ubicacion,
          fecha: fechaStr,
        } as Carrera;
      });
      setCarreras(lista);
    })();
  }, []);

  // Cada vez que cambian los filtros, recalcula resultados
  useEffect(() => {
    const term = q.trim().toLowerCase();
    const cityTerm = city.trim().toLowerCase();
    const dateTerm = date ? new Date(date).toLocaleDateString("es-MX") : "";

    const res = carreras.filter((c) => {
      const matchText = term === "" || c.titulo.toLowerCase().includes(term);
      const matchCity = cityTerm === "" || (c.ubicacion || "").toLowerCase().includes(cityTerm);
      const matchDate = dateTerm === "" || c.fecha === dateTerm;
      return matchText && matchCity && matchDate;
    });
    setFiltered(res);
  }, [q, city, date, carreras]);

  return (
    <div className="relative max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Texto */}
        <div className="relative md:col-span-2">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar carrera..."
            className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
          />
        </div>
        {/* Ciudad */}
        <div className="relative">
          <MapPinIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ciudad"
            className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
          />
        </div>
        {/* Fecha */}
        <div className="relative">
          <CalendarIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Lista de resultados */}
      { (q || city || date) && (
        <ul className="mt-2 max-h-64 overflow-auto border-t pt-2 space-y-1">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <li key={c.id} className="px-3 py-2 hover:bg-gray-100 rounded">
                <Link href={`/inscribirse?carreraId=${c.id}`}>
                  <a className="flex justify-between">
                    <span>{c.titulo}</span>
                    <span className="text-sm text-gray-500">{c.fecha}</span>
                  </a>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-gray-500">No se encontraron carreras.</li>
          )}
        </ul>
      )}
    </div>
  );
}