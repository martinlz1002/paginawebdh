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

  // ✅ nuevos (opcionales)
  inscripcionesAbiertas?: boolean;
  inscripcionesMensaje?: string;

  // interno
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

  // Carga inicial de carreras
  useEffect(() => {
    (async () => {
      const snapshot = await getDocs(collection(db, "carreras"));
      const today = new Date();
      today.setHours(0, 0, 0, 0);

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
            // ✅ Soporta tanto "lugar" como "ubicacion"
            ubicacion: c.lugar || c.ubicacion || "",
            fecha: fechaFormateada,
            imagenUrl: c.imagenUrl || "",

            // ✅ estado inscripciones (por defecto abiertas)
            inscripcionesAbiertas: c.inscripcionesAbiertas !== false,
            inscripcionesMensaje: c.inscripcionesMensaje || "",

            carreraDate,
          } as Carrera & { carreraDate: Date | null };
        })
        .filter(
          (c): c is Carrera & { carreraDate: Date } =>
            c.carreraDate !== null && c.carreraDate >= today
        )
        .map(({ carreraDate, ...rest }) => ({ ...rest, carreraDate }));

      setRaw(data);
    })();
  }, []);

  // Filtrado dinámico según query params
  useEffect(() => {
    let filtered = raw;

    if (typeof qTitulo === "string" && qTitulo.trim()) {
      const needle = qTitulo.toLowerCase();
      filtered = filtered.filter((c) => c.titulo.toLowerCase().includes(needle));
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

    // ✅ orden estable por fecha asc
    filtered = filtered
      .slice()
      .sort((a, b) => (a.carreraDate?.getTime() ?? 0) - (b.carreraDate?.getTime() ?? 0));

    setCarreras(filtered);
  }, [raw, qTitulo, qCiudad, qFecha]);

  // Destacados: los primeros 3 por fecha (o cambia a `where destacado==true` si quieres)
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

  return (
    <>
      {/* ✅ SLIDER PRINCIPAL pegado al header (lo más visible) */}
      <section className="max-w-6xl mx-auto px-6 md:px-8 pt-2">
        {/* Nota: HeroSlider incluye el banner “Bienvenido…” como primer slide */}
        <HeroSlider carreras={carreras} />
      </section>

      <main className="max-w-6xl mx-auto px-6 md:px-8 py-10 space-y-16">
        <SearchCard />

        <FeaturedCarreras carreras={destacados} />

        <Testimonials />

        <Gallery limit={6} showAllButton />

        <section id="proximas-carreras" className="space-y-6">
          <h1 className="text-4xl font-extrabold text-center">
            <span className="text-dh-purple">Próximas</span>{" "}
            <span className="text-dh-green">Carreras</span>
          </h1>

          {carreras.length === 0 ? (
            <p className="text-center text-gray-500">No hay carreras que coincidan.</p>
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
                    {/* Imagen */}
                    <div className="aspect-w-16 aspect-h-9 bg-gray-100 relative">
                      {c.imagenUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
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

                      {/* Badge pausa */}
                      {!abiertas && (
                        <div className="absolute top-3 left-3 rounded-full bg-white/90 border border-red-200 px-3 py-1 text-xs font-extrabold text-red-700 inline-flex items-center gap-2">
                          <LockClosedIcon className="w-4 h-4" />
                          Pausadas
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-2">
                      <h3 className="text-xl font-semibold text-dh-ink">{c.titulo}</h3>

                      {c.descripcion && (
                        <p className="text-dh-muted line-clamp-3">{c.descripcion}</p>
                      )}

                      <div className="flex items-center text-dh-muted text-sm gap-4">
                        <time className="flex items-center gap-1">
                          <CalendarIcon className="w-5 h-5" />
                          <span>{c.fecha}</span>
                        </time>

                        {c.ubicacion && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="w-5 h-5" />
                            <span className="line-clamp-1">{c.ubicacion}</span>
                          </span>
                        )}
                      </div>

                      {!abiertas && <p className="text-xs text-red-600">{msgPausa}</p>}

                      <div className="flex justify-end pt-1">
                        {abiertas ? (
                          <Link href={`/inscribirse?carreraId=${c.id}`} legacyBehavior>
                            <a className="inline-flex items-center gap-1 font-semibold text-dh-green hover:text-dh-purple transition">
                              <span>Inscribirse</span>
                              <ArrowRightIcon className="w-5 h-5" />
                            </a>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1 font-semibold text-gray-400 cursor-not-allowed"
                            title={msgPausa}
                          >
                            <span>No disponible</span>
                            <ArrowRightIcon className="w-5 h-5" />
                          </button>
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
