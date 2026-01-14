import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  CalendarIcon,
  MapPinIcon,
  ArrowRightIcon,
  LockClosedIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

import HeroSlider from "@/components/HeroSlider";
import SearchCard from "@/components/SearchCard";
import FeaturedCarreras from "@/components/FeaturedCarreras";
import Testimonials from "@/components/Testimonials";
import Gallery from "@/components/Gallery";

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: string;
  imagenUrl?: string;

  inscripcionesAbiertas?: boolean;
  inscripcionesMensaje?: string;

  resultados?: {
    url?: string;
    publicado?: boolean;
  };

  carreraDate?: Date;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function HomePage() {
  const router = useRouter();
  const { titulo: qTitulo, ubicacion: qCiudad, fecha: qFecha } = router.query;

  const [raw, setRaw] = useState<Carrera[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);

  /* =============================
     CARGA INICIAL (TODAS)
  ============================== */
  useEffect(() => {
    (async () => {
      const snapshot = await getDocs(collection(db, "carreras"));

      const data = snapshot.docs
        .map((docu) => {
          const c = docu.data() as any;

          let fechaFormateada = "";
          let carreraDate: Date | null = null;

          if (c.fecha instanceof Timestamp) {
            const dt = c.fecha.toDate();
            carreraDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
            fechaFormateada = `${pad(carreraDate.getDate())}/${pad(
              carreraDate.getMonth() + 1
            )}/${carreraDate.getFullYear()}`;
          } else if (typeof c.fecha === "string") {
            const [y, m, d] = c.fecha.split("-").map(Number);
            carreraDate = new Date(y, m - 1, d);
            fechaFormateada = `${pad(d)}/${pad(m)}/${y}`;
          }

          return {
            id: docu.id,
            titulo: c.titulo || "(sin título)",
            descripcion: c.descripcion || "",
            ubicacion: c.lugar || c.ubicacion || "",
            fecha: fechaFormateada,
            imagenUrl: c.imagenUrl || "",

            inscripcionesAbiertas: c.inscripcionesAbiertas !== false,
            inscripcionesMensaje: c.inscripcionesMensaje || "",

            resultados: c.resultados || null,

            carreraDate,
          } as Carrera & { carreraDate: Date | null };
        })
        // 🔥 FIX CLAVE: NO filtrar por fecha aquí
        .filter(
          (c): c is Carrera & { carreraDate: Date } =>
            c.carreraDate !== null
        );

      setRaw(data);
    })();
  }, []);

  /* =============================
     FILTRO SOLO FUTURAS
  ============================== */
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = raw.filter(
      (c) => c.carreraDate && c.carreraDate >= today
    );

    if (typeof qTitulo === "string" && qTitulo.trim()) {
      const needle = qTitulo.toLowerCase();
      filtered = filtered.filter((c) =>
        c.titulo.toLowerCase().includes(needle)
      );
    }

    if (typeof qCiudad === "string" && qCiudad.trim()) {
      const needle = qCiudad.toLowerCase();
      filtered = filtered.filter((c) =>
        (c.ubicacion || "").toLowerCase().includes(needle)
      );
    }

    if (typeof qFecha === "string" && qFecha.trim()) {
      filtered = filtered.filter((c) => c.fecha === qFecha);
    }

    filtered = filtered
      .slice()
      .sort(
        (a, b) =>
          (a.carreraDate?.getTime() ?? 0) -
          (b.carreraDate?.getTime() ?? 0)
      );

    setCarreras(filtered);
  }, [raw, qTitulo, qCiudad, qFecha]);

  /* =============================
     DESTACADAS (FUTURAS)
  ============================== */
  const destacados = useMemo(
    () =>
      carreras.slice(0, 3).map((c) => ({
        id: c.id,
        titulo: c.titulo,
        fecha: c.fecha,
        imagenUrl: c.imagenUrl || "/fallback.png",
        destacado: true,
      })),
    [carreras]
  );

  /* =============================
     RESULTADOS RECIENTES
  ============================== */
  const resultadosRecientes = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return raw
      .filter((c) => {
        return (
          c.carreraDate &&
          c.carreraDate < today &&
          c.resultados?.publicado === true &&
          typeof c.resultados?.url === "string" &&
          c.resultados.url.trim()
        );
      })
      .sort(
        (a, b) =>
          (b.carreraDate?.getTime() ?? 0) -
          (a.carreraDate?.getTime() ?? 0)
      )
      .slice(0, 4);
  }, [raw]);

  return (
    <>
      {/* SLIDER */}
      <section className="max-w-6xl mx-auto px-6 md:px-8 pt-2">
         <HeroSlider carreras={carreras} />
      </section>

      <main className="max-w-6xl mx-auto px-6 md:px-8 py-10 space-y-16">
        {/* BUSCADOR + RESULTADOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SearchCard />
          </div>

          {resultadosRecientes.length > 0 && (
            <div className="bg-white rounded-2xl border border-dh-border shadow-dhSm p-4 space-y-4">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <TrophyIcon className="w-5 h-5 text-dh-green" />
                Resultados recientes
              </h3>

              <ul className="space-y-3">
                {resultadosRecientes.map((r) => (
                  <li key={r.id} className="flex flex-col">
                    <span className="text-sm font-semibold text-dh-ink">
                      {r.titulo}
                    </span>
                    <a
                      href={r.resultados!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-dh-green hover:underline"
                    >
                      Ver resultados →
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <FeaturedCarreras carreras={destacados} />

        <Testimonials />

        <Gallery limit={6} showAllButton />

        {/* PRÓXIMAS */}
        <section id="proximas-carreras" className="space-y-6">
          <h1 className="text-4xl font-extrabold text-center">
            <span className="text-dh-purple">Próximas</span>{" "}
            <span className="text-dh-green">Carreras</span>
          </h1>

          {carreras.length === 0 ? (
            <p className="text-center text-gray-500">
              No hay carreras que coincidan.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {carreras.map((c) => {
                const abiertas = c.inscripcionesAbiertas !== false;
                const msgPausa =
                  (c.inscripcionesMensaje || "").trim() ||
                  "Inscripciones pausadas temporalmente.";

                return (
                  <div
                    key={c.id}
                    className="group block bg-dh-panel border border-dh-border rounded-2xl shadow-dhSm overflow-hidden transition hover:shadow-dh hover:-translate-y-0.5"
                  >
                    <div className="aspect-w-16 aspect-h-9 bg-gray-100 relative">
                      {c.imagenUrl ? (
                        <img
                          src={c.imagenUrl}
                          alt={c.titulo}
                          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex items-center justify-center text-gray-400 w-full h-full">
                          Sin imagen
                        </div>
                      )}

                      {!abiertas && (
                        <div className="absolute top-3 left-3 rounded-full bg-white/90 border border-red-200 px-3 py-1 text-xs font-extrabold text-red-700 inline-flex items-center gap-2">
                          <LockClosedIcon className="w-4 h-4" />
                          Pausadas
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-2">
                      <h3 className="text-xl font-semibold text-dh-ink">
                        {c.titulo}
                      </h3>

                      <div className="flex items-center text-dh-muted text-sm gap-4">
                        <time className="flex items-center gap-1">
                          <CalendarIcon className="w-5 h-5" />
                          <span>{c.fecha}</span>
                        </time>

                        {c.ubicacion && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="w-5 h-5" />
                            <span className="line-clamp-1">
                              {c.ubicacion}
                            </span>
                          </span>
                        )}
                      </div>

                      {!abiertas && (
                        <p className="text-xs text-red-600">{msgPausa}</p>
                      )}

                      <div className="flex justify-end pt-1">
                        {abiertas ? (
                          <Link href={`/inscribirse?carreraId=${c.id}`}>
                            <span className="inline-flex items-center gap-1 font-semibold text-dh-green hover:text-dh-purple transition">
                              Inscribirse
                              <ArrowRightIcon className="w-5 h-5" />
                            </span>
                          </Link>
                        ) : (
                          <span className="text-gray-400 text-sm">
                            No disponible
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
