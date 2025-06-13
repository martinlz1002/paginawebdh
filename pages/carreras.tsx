import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Carrera = {
  id: string;
  nombre: string;
  fecha: string;
  lugar: string;
  descripcion: string;
};

export default function CarrerasPage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchCarreras = async () => {
      const querySnapshot = await getDocs(collection(db, "carreras"));
      const datos: Carrera[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        datos.push({
          id: doc.id,
          nombre: d.nombre,
          fecha: d.fecha?.toDate().toLocaleDateString(),
          lugar: d.ubicacion,
          descripcion: d.descripcion,
        });
      });
      setCarreras(datos);
    };
    fetchCarreras();
  }, []);

  const handleInscripcion = (id: string) => {
    router.push(`/inscribirse?id=${id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-softPurple mb-8">Próximas Carreras</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {carreras.map((carrera) => (
          <div key={carrera.id} className="bg-white rounded-xl p-4 shadow border border-softGreen flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-softPurple mb-2">{carrera.nombre}</h2>
              <p className="text-sm text-gray-700 mb-1">📅 {carrera.fecha}</p>
              <p className="text-sm text-gray-700 mb-1">📍 {carrera.lugar}</p>
              <p className="text-sm text-gray-600 mt-2">{carrera.descripcion}</p>
            </div>
            <button
              onClick={() => handleInscripcion(carrera.id)}
              className="mt-4 bg-softPurple text-white py-2 px-4 rounded hover:opacity-90"
            >
              Inscribirse
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}