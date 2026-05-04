import Link from "next/link";
import { CalendarIcon, TrophyIcon } from "@heroicons/react/24/outline";

interface Carrera {
  id: string;
  titulo: string;
  fecha: string; // yyyy-mm-dd
  imagenUrl: string;
  destacado?: boolean;
  resultados?: {
    url?: string;
    publicado?: boolean;
  };
}

function parseYYYYMMDD(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function FeaturedCarreras({ carreras }: { carreras: Carrera[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-extrabold text-dh-muted text-center">
        Carreras <span className="text-dh-purple">Destacadas</span>
      </h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {carreras
          .filter((c) => c.destacado)
          .map((c) => {
            const carreraDate = parseYYYYMMDD(c.fecha);
            const finalizada = carreraDate < today;
            const resultadosPublicados =
              finalizada && c.resultados?.publicado && c.resultados?.url;

            const href = resultadosPublicados
              ? c.resultados!.url!
              : `/inscribirse?carreraId=${c.id}`;

            return (
              <Link
                key={c.id}
                href={href}
                {...(resultadosPublicados
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <a
                  className={[
                    "group relative overflow-hidden rounded-2xl",
                    "border border-white/10 bg-white/5 backdrop-blur",
                    "shadow-dh transition hover:shadow-xl",
                  ].join(" ")}
                >
                  {/* Imagen */}
                  <div className="h-48 overflow-hidden">
                    <img
                      src={c.imagenUrl}
                      alt={c.titulo}
                      className={[
                        "w-full h-full object-cover transition-transform duration-500",
                        finalizada ? "grayscale" : "group-hover:scale-105",
                      ].join(" ")}
                    />
                  </div>

                  {/* Overlay base */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                  {/* Overlay RESULTADOS */}
                  {finalizada && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className={[
                          "px-4 py-2 rounded-xl text-sm font-extrabold backdrop-blur",
                          resultadosPublicados
                            ? "bg-dh-purple/90 text-dh-dark"
                            : "bg-black/60 text-white",
                        ].join(" ")}
                      >
                        {resultadosPublicados ? (
                          <span className="flex items-center gap-2">
                            <TrophyIcon className="w-5 h-5" />
                            Ver resultados
                          </span>
                        ) : (
                          "Carrera finalizada"
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contenido */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
                    <h3 className="text-lg font-bold text-dh-ink leading-tight">
                      {c.titulo}
                    </h3>
                    <p className="flex items-center text-sm text-dh-ink/80">
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      {c.fecha}
                    </p>
                  </div>

                  {/* Glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition pointer-events-none ring-1 ring-dh-purple/30 rounded-2xl" />
                </a>
              </Link>
            );
          })}
      </div>
    </section>
  );
}
