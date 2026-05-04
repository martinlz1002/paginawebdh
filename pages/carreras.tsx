import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import {
  CalendarIcon,
  MapPinIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

type Carrera = {
  id: string;
  titulo: string;
  fecha: string;
  lugar: string;
  descripcion: string;
  imagenUrl?: string;
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

      const datos: Carrera[] = snap.docs.map((d) => {
        const x = d.data() as any;

        let fecha = "";
        if (x.fecha instanceof Timestamp) {
          const dt = x.fecha.toDate();
          const local = new Date(
            dt.getTime() + dt.getTimezoneOffset() * 60000
          );
          fecha = `${pad(local.getDate())}/${pad(
            local.getMonth() + 1
          )}/${local.getFullYear()}`;
        } else if (typeof x.fecha === "string") {
          const [y, m, dd] = x.fecha.split("-");
          if (y && m && dd) fecha = `${dd}/${m}/${y}`;
        }

        return {
          id: d.id,
          titulo: x.titulo || x.nombre || "Sin título",
          lugar: x.lugar || x.ubicacion || "",
          descripcion: x.descripcion || "",
          imagenUrl: x.imagenUrl || x.bannerUrl || undefined,
          fecha,
        };
      });

      setCarreras(datos);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0c0f] text-white relative overflow-hidden">

      {/* Glow fondo */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/20 via-black to-dh-green/20 blur-3xl opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 space-y-16">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6"
        >
          <h1 className="text-5xl md:text-6xl font-black leading-tight">
            Explora todas las
            <span className="block bg-gradient-to-r from-dh-purple to-dh-green bg-clip-text text-transparent">
              Carreras
            </span>
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto">
            Encuentra tu próximo reto y prepárate para cruzar la meta.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {carreras.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black"
            >
              {/* Imagen */}
              <div className="relative h-60 overflow-hidden">
                {c.imagenUrl ? (
                  <img
                    src={c.imagenUrl}
                    alt={c.titulo}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40">
                    Sin imagen
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              </div>

              {/* Contenido */}
              <div className="p-6 space-y-4">

                <h2 className="text-2xl font-black leading-tight">
                  {c.titulo}
                </h2>

                <div className="flex flex-wrap gap-6 text-white/70 text-sm">
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    {c.fecha || "Fecha por definir"}
                  </span>

                  <span className="flex items-center gap-2">
                    <MapPinIcon className="w-5 h-5" />
                    {c.lugar || "Lugar por definir"}
                  </span>
                </div>

                {c.descripcion && (
                  <p className="text-white/70 text-sm line-clamp-3">
                    {c.descripcion}
                  </p>
                )}

                <button
                  onClick={() =>
                    router.push(`/inscribirse?carreraId=${c.id}`)
                  }
                  className="mt-4 w-full bg-dh-green text-black font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(0,255,120,0.4)] transition-all"
                >
                  Inscribirme
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Línea animada inferior */}
              <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-dh-purple to-dh-green group-hover:w-full transition-all duration-500" />
            </motion.div>
          ))}
        </div>

        {carreras.length === 0 && (
          <p className="text-center text-white/50">
            No hay carreras registradas todavía.
          </p>
        )}

      </div>
    </div>
  );
}
