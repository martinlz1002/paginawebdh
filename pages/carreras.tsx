import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CalendarIcon,
  MapPinIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

type Carrera = {
  id: string;
  titulo: string;
  fecha: string;
  lugar: string;
  descripcion: string;
  imagenUrl?: string;
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function CarrerasPage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));

      const datos: Carrera[] = snap.docs
        .map((d) => {
          const x = d.data() as any;

          // ✅ fecha consistente (DD/MM/YYYY)
          let fecha = "";
          if (x.fecha instanceof Timestamp) {
            const dt = x.fecha.toDate();
            const local = new Date(
              dt.getTime() + dt.getTimezoneOffset() * 60000
            );
            fecha = `${pad(local.getDate())}/${pad(
              local.getMonth() + 1
            )}/${local.getFullYear()}`;
          } else if (typeof x.fecha === "string") {
            const [y, m, dd] = x.fecha.split("-");
            if (y && m && dd) fecha = `${dd}/${m}/${y}`;
          }

          return {
            id: d.id,
            // ✅ en tu proyecto es "titulo" (y fallback por si quedó "nombre" viejo)
            titulo: x.titulo || x.nombre || "Sin título",
            // ✅ lugar puede venir como lugar/ubicacion
            lugar: x.lugar || x.ubicacion || "",
            descripcion: x.descripcion || "",
            imagenUrl: x.imagenUrl || x.bannerUrl || undefined,
            fecha,
          } as Carrera;
        })
        // opcional: si no tiene fecha parseada, igual la mostramos (pero puedes filtrar si quieres)
        .filter((c) => Boolean(c.titulo));

      setCarreras(datos);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-dh-soft">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold text-dh-ink">
            Todas las <span className="text-dh-green">Carreras</span>
          </h1>
          <p className="text-gray-600">
            Elige tu evento y vámonos recio 🏁
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {carreras.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl shadow-dh border border-dh-purple/10 overflow-hidden hover:shadow-lg transition"
            >
              {/* Imagen opcional */}
              <div className="relative h-44 bg-gradient-to-r from-dh-purple/10 to-dh-green/10">
                {c.imagenUrl ? (
                  <img
                    src={c.imagenUrl}
                    alt={c.titulo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                    Sin imagen
                  </div>
                )}
                {/* overlay suave */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>

              <div className="p-6 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <h2 className="text-xl font-bold text-dh-purple">
                    {c.titulo}
                  </h2>

                  <div className="flex items-center gap-3 text-gray-600">
                    <CalendarIcon className="w-5 h-5 text-dh-green" />
                    <span>{c.fecha || "Fecha por definir"}</span>
                  </div>

                  <div className="flex items-center gap-3 text-gray-600">
                    <MapPinIcon className="w-5 h-5 text-dh-green" />
                    <span className="truncate">
                      {c.lugar || "Lugar por definir"}
                    </span>
                  </div>

                  {c.descripcion && (
                    <p className="text-gray-600 leading-relaxed line-clamp-3">
                      {c.descripcion}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => router.push(`/inscribirse?carreraId=${c.id}`)}
                  className="w-full bg-dh-purple text-white py-2.5 px-4 rounded-xl hover:opacity-95 transition flex items-center justify-center gap-2"
                >
                  <span className="font-semibold">Inscribirse</span>
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {carreras.length === 0 && (
          <p className="text-center text-gray-500">
            No hay carreras registradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}