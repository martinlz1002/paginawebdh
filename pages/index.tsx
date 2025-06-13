import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
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

export default function HomePage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);

  useEffect(() => {
    const fetchCarreras = async () => {
      const snapshot = await getDocs(collection(db, "carreras"));
      const data = snapshot.docs.map((doc) => {
        const c = doc.data();
        return {
          id: doc.id,
          titulo: c.titulo,
          descripcion: c.descripcion,
          ubicacion: c.ubicacion,
          fecha: c.fecha?.toDate().toLocaleDateString() || "",
          imagenUrl: c.imagenUrl || "",
        };
      });
      setCarreras(data);
    };

    fetchCarreras();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Próximas Carreras</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {carreras.map((carrera) => (
          <div
            key={carrera.id}
            className="border rounded-lg shadow p-4 flex flex-col items-center"
          >
            {carrera.imagenUrl ? (
              <img
                src={carrera.imagenUrl}
                alt={carrera.titulo}
                className="w-full h-48 object-cover rounded mb-4"
              />
            ) : (
              <div className="w-full mb-4">
                <h2 className="text-xl font-semibold">{carrera.titulo}</h2>
                <p className="text-sm text-gray-600">{carrera.descripcion}</p>
                <p className="text-sm">📍 {carrera.ubicacion}</p>
                <p className="text-sm">📅 {carrera.fecha}</p>
              </div>
            )}
            <Link
              href={`/inscribirse?carreraId=${carrera.id}`}
              className="mt-auto bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Inscribirse
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}