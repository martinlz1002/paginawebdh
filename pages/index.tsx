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
    (async () => {
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
    })();
  }, []);

  const handleInscripcion = (id: string) => {
    router.push(`/inscribirse?id=${id}`);
  };

  return (
    <section className="py-12 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center text-purple-600 mb-8">
          Próximas Carreras
        </h1>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {carreras.map(c => (
            <div
              key={c.id}
              className="flex flex-col justify-between bg-green-50 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-green-700">
                  {c.nombre}
                </h2>
                <p className="text-gray-700">📅 {c.fecha}</p>
                <p className="text-gray-700">📍 {c.lugar}</p>
                <p className="text-gray-600 mt-2">{c.descripcion}</p>
              </div>
              <button
                onClick={() => handleInscripcion(c.id)}
                className="mt-6 bg-gradient-to-r from-purple-500 to-green-500 text-white py-2 rounded-lg hover:from-purple-600 hover:to-green-600 transition-colors"
              >
                Inscribirse
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}