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
          <Link
            key={carrera.id}
            href={`/inscribirse?carreraId=${carrera.id}`}
            className="group block border rounded-lg shadow hover:shadow-lg transition-shadow duration-200"
          >
            <div className="overflow-hidden rounded-t-lg">
              {carrera.imagenUrl ? (
                <img
                  src={carrera.imagenUrl}
                  alt={carrera.titulo}
                  className="w-full h-48 object-cover transform transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                  <div className="text-center p-4">
                    <h2 className="text-xl font-semibold">{carrera.titulo}</h2>
                    <p className="text-sm text-gray-600">
                      📍 {carrera.ubicacion}
                    </p>
                    <p className="text-sm text-gray-600">📅 {carrera.fecha}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-1">{carrera.titulo}</h2>
              <p className="text-sm text-gray-700 mb-2">{carrera.descripcion}</p>
              <p className="text-sm text-gray-500">
                📅 {carrera.fecha} · 📍 {carrera.ubicacion}
              </p>
              <button className="mt-3 inline-block bg-purple-600 text-white py-1 px-3 rounded hover:bg-purple-700 transition-colors duration-200">
                Inscribirse
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}