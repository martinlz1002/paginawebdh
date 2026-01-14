import Link from "next/link";

interface HeroSlide {
  id: string;
  titulo: string;
  fecha: string;
  imagenUrl?: string;
  tipo: "inscripcion" | "resultados";
  resultados?: {
    url?: string;
    publicado?: boolean;
  };
}

interface HeroSliderProps {
  carreras: HeroSlide[];
}

export default function HeroSlider({ carreras }: HeroSliderProps) {
  return (
    <div className="space-y-6">
      {carreras.map((c) => (
        <section
          key={c.id}
          className="relative overflow-hidden rounded-2xl border border-dh-border bg-dh-panel shadow-dhSm"
        >
          {/* Imagen de fondo */}
          {c.imagenUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.imagenUrl}
                alt={c.titulo}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/55" />
            </>
          )}

          {/* Contenido */}
          <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12 text-white space-y-4">
            <span className="inline-block text-xs font-extrabold tracking-wide bg-white/20 px-3 py-1 rounded-full">
              {c.tipo === "resultados"
                ? "RESULTADOS"
                : "INSCRIPCIONES ABIERTAS"}
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold">
              {c.titulo}
            </h2>

            <p className="text-sm opacity-90">
              {c.tipo === "resultados"
                ? "Carrera finalizada"
                : c.fecha}
            </p>

            {c.tipo === "inscripcion" && (
              <Link
                href={`/inscribirse?carreraId=${c.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95"
              >
                Inscribirme
              </Link>
            )}

            {c.tipo === "resultados" && c.resultados?.url && (
              <a
                href={c.resultados.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95"
              >
                🏁 Ver resultados
              </a>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
