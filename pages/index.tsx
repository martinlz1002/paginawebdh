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
    const fetchCarreras = async () => {
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
    };
    fetchCarreras();
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-12">
        Próximas Carreras
      </h1>
      <div className="grid gap-y-10 gap-x-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {carreras.map(c => (
          <Link
            key={c.id}
            href={`/inscribirse?carreraId=${c.id}`}
            className="group block bg-white rounded-2xl shadow-lg overflow-hidden transform hover:scale-[1.02] transition"
          >
            <div className="aspect-video bg-gray-100">
              {c.imagenUrl ? (
                <img
                  src={c.imagenUrl}
                  alt={c.titulo}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  Sin imagen
                </div>
              )}
            </div>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-2 text-gray-800 group-hover:text-purple-600">
                {c.titulo}
              </h2>
              {c.descripcion && (
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {c.descripcion}
                </p>
              )}
              <p className="text-sm text-gray-500 mb-6">
                📅 {c.fecha} {c.ubicacion && <>· 📍 {c.ubicacion}</>}
              </p>
              <button className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 transition">
                Inscribirse
              </button>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}