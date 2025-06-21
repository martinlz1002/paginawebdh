import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CalendarIcon, MapPinIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

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
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8 text-center text-green-800">Todas las Carreras</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {carreras.map(c => (
          <div
            key={c.id}
            className="bg-white rounded-xl p-6 shadow-md transform transition hover:shadow-lg hover:scale-105 duration-200 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-purple-700">{c.nombre}</h2>
              <div className="flex items-center space-x-3 text-gray-600">
                <CalendarIcon className="w-5 h-5" />
                <span>{c.fecha}</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-600">
                <MapPinIcon className="w-5 h-5" />
                <span>{c.lugar}</span>
              </div>
              <p className="text-gray-500 mt-2">{c.descripcion}</p>
            </div>
            <button
              onClick={() => router.push(`/inscribirse?id=${c.id}`)}
              className="mt-6 bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 flex items-center justify-center space-x-2"
            >
              <span>Inscribirse</span>
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}