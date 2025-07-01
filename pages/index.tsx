import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  CalendarIcon,
  MapPinIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: string;       // "DD/MM/YYYY"
  imagenUrl?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function HomePage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);

  useEffect(() => {
    (async () => {
      const snapshot = await getDocs(collection(db, "carreras"));
      const hoy = new Date();
      // normalizar hora a medianoche
      const today = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

      const data = snapshot.docs
        .map(doc => {
          const c = doc.data() as any;
          let fechaFormateada = "";
          let carreraDate: Date | null = null;

          if (c.fecha instanceof Timestamp) {
            const dt = c.fecha.toDate();
            // convertir a local sin desfase
            carreraDate = new Date(
              dt.getFullYear(),
              dt.getMonth(),
              dt.getDate()
            );
            fechaFormateada = `${pad(carreraDate.getDate())}/${pad(
              carreraDate.getMonth() + 1
            )}/${carreraDate.getFullYear()}`;
          } else if (typeof c.fecha === "string") {
            const [y, m, d] = c.fecha.split("-").map(Number);
            carreraDate = new Date(y, m - 1, d);
            fechaFormateada = `${pad(d)}/${pad(m)}/${y}`;
          }

          return {
            id: doc.id,
            titulo: c.titulo,
            descripcion: c.descripcion,
            ubicacion: c.ubicacion,
            fecha: fechaFormateada,
            imagenUrl: c.imagenUrl,
            carreraDate,
          } as Carrera & { carreraDate: Date | null };
        })
        .filter((c): c is Carrera & { carreraDate: Date } =>
          c.carreraDate !== null && c.carreraDate >= today
        )
        .map(({ carreraDate, ...rest }) => rest);

      setCarreras(data);
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center text-green-800">
        Próximas Carreras
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {carreras.map(c => (
          <Link
            key={c.id}
            href={`/inscribirse?carreraId=${c.id}`}
            className="group block overflow-hidden bg-white rounded-xl shadow-md transform transition hover:shadow-xl hover:scale-105 duration-200"
          >
            <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
              {c.imagenUrl ? (
                <img
                  src={c.imagenUrl}
                  alt={c.titulo}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <span className="text-gray-500">Sin imagen</span>
              )}
            </div>
            <div className="p-5 space-y-3">
              <h2 className="text-xl font-semibold text-gray-800">
                {c.titulo}
              </h2>
              {c.descripcion && (
                <p className="text-gray-600 line-clamp-3">
                  {c.descripcion}
                </p>
              )}
              <div className="flex items-center text-gray-500 text-sm space-x-4">
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="w-5 h-5" />
                  <span>{c.fecha}</span>
                </div>
                {c.ubicacion && (
                  <div className="flex items-center space-x-1">
                    <MapPinIcon className="w-5 h-5" />
                    <span>{c.ubicacion}</span>
                  </div>
                )}
              </div>
              <div className="pt-4 flex justify-end">
                <button className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-medium">
                  <span>Inscribirse</span>
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}