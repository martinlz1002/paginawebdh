import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, Timestamp } from "firebase/firestore";
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
        const snap = await getDoc(doc(db, "carreras", id as string));
        if (!snap.exists()) {
          setError("Carrera no encontrada");
          return;
        }
        setCarrera({ id: snap.id, ...snap.data() });
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
  const hayResultados = carreraFinalizada && resultadosPublicado && resultadosUrl;

  return (
    <div className="min-h-screen bg-dh-soft px-4 py-12">
      <div className="max-w-4xl mx-auto space-y-8">
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

        {/* Estado */}
        {carreraFinalizada ? (
          <div className="rounded-2xl border border-dh-purple/20 bg-dh-soft p-6 text-center space-y-4">
            <div className="text-lg font-extrabold text-dh-ink">
              🏁 Carrera finalizada
            </div>
            <p className="text-sm text-gray-600">
              Este evento ya se llevó a cabo.
            </p>

            {hayResultados && (
              <a
                href={resultadosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95 transition"
              >
                🏁 Ver resultados oficiales
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dh-green/20 bg-white p-6 text-center space-y-4">
            <div className="text-lg font-extrabold text-dh-ink">
              Inscripciones abiertas
            </div>

            <Link
              href={`/inscribirse?carreraId=${encodeURIComponent(carrera.id)}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95 transition"
            >
              Inscribirme
            </Link>
          </div>
        )}

        {/* Footer status */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <CheckCircleIcon className="w-4 h-4 text-dh-green" />
          Evento oficial DHTime
        </div>
      </div>
    </div>
  );
}
