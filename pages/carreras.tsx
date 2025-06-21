import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Carrera = {
  id: string;
  nombre: string;
  fecha: string;
  lugar: string;
  descripcion: string;
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function CarrerasPage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchCarreras = async () => {
      const snap = await getDocs(collection(db, "carreras"));
      const datos: Carrera[] = snap.docs.map(d => {
        const x = d.data() as any;

        // corregir fecha
        let fecha = "";
        if (x.fecha instanceof Timestamp) {
          const dt = x.fecha.toDate();
          const local = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
          fecha = `${pad(local.getDate())}/${pad(local.getMonth()+1)}/${local.getFullYear()}`;
        } else if (typeof x.fecha === "string") {
          const [y,m,dd] = x.fecha.split("-");
          fecha = `${dd}/${m}/${y}`;
        }

        return {
          id: d.id,
          nombre: x.nombre,
          fecha,
          lugar: x.ubicacion,
          descripcion: x.descripcion,
        };
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
        {carreras.map(c => (
          <div key={c.id} className="bg-white rounded-xl p-4 shadow border border-softGreen flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-softPurple mb-2">{c.nombre}</h2>
              <p className="text-sm text-gray-700 mb-1">📅 {c.fecha}</p>
              <p className="text-sm text-gray-700 mb-1">📍 {c.lugar}</p>
              <p className="text-sm text-gray-600 mt-2">{c.descripcion}</p>
            </div>
            <button
              onClick={() => handleInscripcion(c.id)}
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