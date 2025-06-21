import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: string;        // ya formateada
  imagenUrl?: string;
}

export default function HomePage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);

  useEffect(() => {
    const fetchCarreras = async () => {
      const snapshot = await getDocs(collection(db, "carreras"));
      const data = snapshot.docs.map(doc => {
        const c = doc.data() as any;

        // Si es Timestamp, usamos getUTC* para la fecha exacta
        let fechaFormateada = "";
        if (c.fecha instanceof Timestamp) {
          const dt = c.fecha.toDate();
          const day = dt.getUTCDate().toString().padStart(2, "0");
          const month = (dt.getUTCMonth() + 1).toString().padStart(2, "0");
          const year = dt.getUTCFullYear();
          fechaFormateada = `${day}/${month}/${year}`;
        } else if (typeof c.fecha === "string") {
          fechaFormateada = new Date(c.fecha).toLocaleDateString();
        }

        return {
          id: doc.id,
          titulo: c.titulo,
          descripcion: c.descripcion,
          ubicacion: c.ubicacion,
          fecha: fechaFormateada,
          imagenUrl: c.imagenUrl,
        };
      });
      setCarreras(data);
    };

    fetchCarreras();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">Próximas Carreras</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {carreras.map(c => (
          <Link
            key={c.id}
            href={`/inscribirse?carreraId=${c.id}`}
            className="group block border rounded-xl shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden bg-white"
          >
            <div className="relative pb-[56.25%] overflow-hidden">
              {c.imagenUrl ? (
                <img
                  src={c.imagenUrl}
                  alt={c.titulo}
                  className="absolute inset-0 w-full h-full object-cover transform transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">Sin imagen</span>
                </div>
              )}
            </div>
            <div className="p-5">
              <h2 className="text-xl font-semibold mb-2">{c.titulo}</h2>
              {c.descripcion && (
                <p className="text-gray-700 mb-3 line-clamp-3">{c.descripcion}</p>
              )}
              <p className="text-sm text-gray-500 mb-4">
                📅 {c.fecha} {c.ubicacion && <>· 📍 {c.ubicacion}</>}
              </p>
              <button className="inline-block bg-purple-600 text-white font-medium py-2 px-4 rounded hover:bg-purple-700 transition-colors">
                Inscribirse
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}