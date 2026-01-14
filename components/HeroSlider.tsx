import Link from "next/link";

interface HeroSlideCarreraProps {
  tipo: "inscripcion" | "resultados";
  titulo: string;
  fecha: string;
  imagenUrl?: string;
  carreraId?: string;
  resultadosUrl?: string;
}

export default function HeroSlideCarrera({
  tipo,
  titulo,
  fecha,
  imagenUrl,
  carreraId,
  resultadosUrl,
}: HeroSlideCarreraProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl shadow-dhSm">
      {imagenUrl && (
        <img
          src={imagenUrl}
          alt={titulo}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 text-white space-y-4">
        <span className="inline-block text-xs font-extrabold tracking-wide bg-white/20 px-3 py-1 rounded-full">
          {tipo === "resultados" ? "RESULTADOS" : "INSCRIPCIONES ABIERTAS"}
        </span>

        <h2 className="text-3xl sm:text-4xl font-extrabold">{titulo}</h2>

        <p className="text-sm opacity-90">
          {tipo === "resultados" ? "Carrera finalizada" : fecha}
        </p>

        {tipo === "resultados" && resultadosUrl && (
          <a
            href={resultadosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95"
          >
            🏁 Ver resultados
          </a>
        )}

        {tipo === "inscripcion" && carreraId && (
          <Link
            href={`/inscribirse?carreraId=${carreraId}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95"
          >
            Inscribirme
          </Link>
        )}
      </div>
    </section>
  );
}
