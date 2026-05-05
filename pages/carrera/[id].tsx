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
      <div className="max-w-4xl mx-auto space-y-8">

        {carrera.imagenUrl && (
  <div className="w-full h-64 md:h-96 rounded-2xl overflow-hidden">
    <img
      src={carrera.imagenUrl}
      className="w-full h-full object-cover"
    />
  </div>
)}
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-dh p-6 text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-dh-ink">
            {carrera.titulo}
          </h1>

          {carrera.descripcion && (
            <p className="text-gray-600 max-w-2xl mx-auto">
              {carrera.descripcion}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-3 pt-3 text-sm">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dh-soft border">
              <CalendarIcon className="w-4 h-4 text-dh-purple" />
              {fechaTexto}
            </span>

            {carrera.lugar && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dh-soft border">
                <MapPinIcon className="w-4 h-4 text-dh-green" />
                {carrera.lugar}
              </span>
            )}
          </div>
        </div>


{Array.isArray(carrera.distancias) && carrera.distancias.length > 0 && (
  <div className="bg-white rounded-2xl shadow-dh p-6 space-y-4">
    <h2 className="text-xl font-bold text-dh-ink">
      Distancias y categorías
    </h2>

    {carrera.distancias.map((d: any, idx: number) => (
      <div key={idx} className="border-t pt-3">
        <p className="font-semibold text-dh-ink">
          {d.distancia}
        </p>

        {Array.isArray(d.categorias) && (
          <p className="text-sm text-gray-600">
            {d.categorias.map((c: any) => c.nombre).join(", ")}
          </p>
        )}
      </div>
    ))}
  </div>
)}


        {/* Estado */}
       {carreraFinalizada ? (
  // 🏁 FINALIZADA
  <div className="rounded-2xl border border-dh-purple/20 bg-dh-soft p-6 text-center space-y-4">
    <div className="text-lg font-extrabold text-dh-ink">
      🏁 Carrera finalizada
    </div>

    {hayResultados && (
      <a
        href={resultadosUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold"
      >
        Ver resultados
      </a>
    )}
  </div>
) : carrera.linkExterno ? (
  // 🌐 INSCRIPCIÓN EXTERNA
  <div className="rounded-2xl border border-dh-purple/20 bg-white p-6 text-center space-y-4">

    <div className="text-lg font-extrabold text-dh-ink">
      Inscripciones disponibles
    </div>

    <a
      href={carrera.linkExterno}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-purple text-white font-extrabold hover:opacity-90 transition"
    >
      Ir a inscripción
    </a>

  </div>
) : (
  // 🟢 NORMAL
  <div className="rounded-2xl border border-dh-green/20 bg-white p-6 text-center space-y-4">
    <div className="text-lg font-extrabold text-dh-ink">
      Inscripciones abiertas
    </div>

    <Link
      href={`/inscribirse?carreraId=${encodeURIComponent(carrera.id)}`}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold"
    >
      Inscribirme
    </Link>
  </div>
)}

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <CheckCircleIcon className="w-4 h-4 text-dh-green" />
          Evento oficial DHTime
        </div>
      </div>
    </div>
  );
}