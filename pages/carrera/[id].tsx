import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  doc,
  getDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CalendarIcon,
  MapPinIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

function parseISODateYYYYMMDD(iso: any): Date {
  if (!iso || typeof iso !== "string") return new Date("2000-01-01");
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date("2000-01-01") : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export default function CarreraDetalle() {
  const router = useRouter();
  const { id } = router.query;

  const [carrera, setCarrera] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        // 🧠 1. Intentar como ID (flujo actual intacto)
        const snap = await getDoc(doc(db, "carreras", id as string));

        if (snap.exists()) {
          setCarrera({ id: snap.id, ...snap.data() });
          return;
        }

        // 🧠 2. Si no existe, intentar como SLUG
        const q = query(
          collection(db, "carreras"),
          where("slug", "==", id)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setCarrera({ id: docData.id, ...docData.data() });
          return;
        }

        // 💀 Nada encontrado
        setError("Carrera no encontrada");
      } catch (e: any) {
        setError(e?.message || "Error cargando carrera");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando…</div>;
  }

  if (error || !carrera) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  const fechaDate =
    carrera.fecha instanceof Timestamp
      ? carrera.fecha.toDate()
      : parseISODateYYYYMMDD(carrera.fecha);

  const fechaTexto = fechaDate.toLocaleDateString("es-MX");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const carreraFinalizada = fechaDate < today;

  const resultadosUrl = carrera?.resultados?.url;
  const resultadosPublicado = carrera?.resultados?.publicado === true;
  const hayResultados =
    carreraFinalizada && resultadosPublicado && resultadosUrl;

  return (
  <div className="min-h-screen bg-dh-soft px-4 py-12">
    <div className="max-w-5xl mx-auto space-y-10">

      {/* 🖼️ Banner */}
      {carrera.imagenUrl && (
        <div className="w-full h-64 md:h-96 rounded-3xl overflow-hidden shadow-dhSoft">
          <img
            src={carrera.imagenUrl}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* 🧾 HEADER */}
      <div className="bg-white rounded-3xl shadow-dh p-8 text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">
          {carrera.titulo}
        </h1>

        {carrera.descripcion && (
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {carrera.descripcion}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-3 text-sm">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dh-soft border text-gray-900">
            <CalendarIcon className="w-4 h-4 text-dh-purple" />
            {fechaTexto}
          </span>

          {carrera.lugar && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dh-soft border text-gray-900">
              <MapPinIcon className="w-4 h-4 text-dh-green" />
              {carrera.lugar}
            </span>
          )}
        </div>
      </div>

      {/* 🏁 DISTANCIAS PRO */}
      {Array.isArray(carrera.distancias) && carrera.distancias.length > 0 && (
        <div className="bg-white rounded-3xl shadow-dh p-8 space-y-6">
          <h2 className="text-2xl font-black text-gray-900">
            Distancias y categorías
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {carrera.distancias.map((d: any, idx: number) => (
              <div
                key={idx}
                className="group relative p-6 rounded-2xl bg-dh-soft border border-gray-200 hover:border-dh-purple/40 transition"
              >
                {/* glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-dh-glow rounded-2xl" />

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-extrabold text-gray-900">
                    {d.distancia}
                  </h3>

                  <span className="text-xs px-3 py-1 rounded-full bg-dh-purple/10 text-dh-purple font-semibold">
                    {d.categorias?.length || 0} categorías
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {d.categorias?.map((c: any, i: number) => (
                    <span
                      key={i}
                      className="text-xs px-3 py-1 rounded-full bg-white border text-gray-700 hover:bg-dh-purple/10 hover:text-dh-purple transition"
                    >
                      {c.nombre}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🎯 ESTADO */}
      {carreraFinalizada ? (
        <div className="rounded-3xl border border-dh-purple/20 bg-dh-soft p-8 text-center space-y-4">
          <div className="text-lg font-extrabold text-gray-900">
            🏁 Carrera finalizada
          </div>

          {hayResultados && (
            <a
              href={resultadosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:scale-105 transition"
            >
              Ver resultados
            </a>
          )}
        </div>
      ) : carrera.linkExterno ? (
        // 🌐 EXTERNO (tu caso actual)
        <div className="rounded-3xl border border-dh-purple/20 bg-white p-8 text-center space-y-4">
          <div className="text-lg font-extrabold text-gray-900">
            Inscripciones disponibles
          </div>

          <a
            href={carrera.linkExterno}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-dh-purple to-dh-purpleLight text-white font-bold hover:scale-105 active:scale-95 transition shadow-lg"
          >
            Inscribirme
          </a>
        </div>
      ) : (
        // 🟢 NORMAL
        <div className="rounded-3xl border border-dh-purple/20 bg-white p-8 text-center space-y-4">
          <div className="text-lg font-extrabold text-gray-900">
            Inscripciones abiertas
          </div>

          <Link href={`/inscribirse?slug=${carrera.id}`}>
            <span className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-dh-purple to-dh-purpleLight text-white font-bold cursor-pointer hover:scale-105 active:scale-95 transition shadow-lg">
              Inscribirme
            </span>
          </Link>
        </div>
      )}

      {/* FOOTER */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <CheckCircleIcon className="w-4 h-4 text-dh-green" />
        Evento oficial DHTime
      </div>
    </div>
  </div>
);
}