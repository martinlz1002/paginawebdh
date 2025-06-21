import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: string;
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
      const data = snapshot.docs.map(doc => {
        const c = doc.data() as any;
        let fechaFormateada = "";
        if (c.fecha instanceof Timestamp) {
          const dt = c.fecha.toDate();
          const local = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
          fechaFormateada = `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()}`;
        } else if (typeof c.fecha === "string") {
          const [y, m, d] = c.fecha.split("-");
          fechaFormateada = `${d}/${m}/${y}`;
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
    })();
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
            {/* ratio 16:9 con el plugin */}
            <div className="aspect-video bg-gray-100 flex items-center justify-center">
              {c.imagenUrl ? (
                <img
                  src={c.imagenUrl}
                  alt={c.titulo}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-gray-500">Sin imagen</span>
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
              <button className="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700">
                Inscribirse
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}