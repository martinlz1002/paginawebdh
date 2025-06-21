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
        let fecha = "";
        if (x.fecha instanceof Timestamp) {
          const dt = x.fecha.toDate();
          const local = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
          fecha = `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()}`;
        } else if (typeof x.fecha === "string") {
          const [y, m, dd] = x.fecha.split("-");
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
    <main className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-extrabold text-center mb-10">Próximas Carreras</h1>
      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {carreras.map(c => (
          <div
            key={c.id}
            className="bg-white rounded-2xl shadow-lg p-6 flex flex-col justify-between transform hover:scale-[1.02] transition"
          >
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-purple-600">{c.nombre}</h2>
              <p className="text-gray-600 text-sm">📅 {c.fecha}</p>
              <p className="text-gray-600 text-sm">📍 {c.lugar}</p>
              <p className="text-gray-700">{c.descripcion}</p>
            </div>
            <button
              onClick={() => handleInscripcion(c.id)}
              className="mt-6 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
            >
              Inscribirse
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}