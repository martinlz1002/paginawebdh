import Link from "next/link";

interface HeroBannerProps {
  tipo: "inscripcion" | "resultados";
  titulo: string;
  subtitulo: string;
  imagenUrl?: string;
  resultadosUrl?: string;
  carreraId?: string;
}

export default function HeroBanner({
  tipo,
  titulo,
  subtitulo,
  imagenUrl,
  resultadosUrl,
  carreraId,
}: HeroBannerProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-dh-border bg-dh-panel shadow-dhSm">
      {/* Imagen fondo */}
      {imagenUrl && (
        <img
          src={imagenUrl}
          alt={titulo}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/80 to-dh-bg/90" />

      {/* Logo watermark */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <img
          src="/mi-logo.png"
          alt="DHTime Logo"
          className="w-[70%] max-w-[900px] opacity-[0.08]"
        />
      </div>

      {/* Contenido */}
      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-dh-ink">
          {titulo}
        </h1>

        <p className="text-dh-muted text-base sm:text-lg">{subtitulo}</p>

        {tipo === "resultados" && resultadosUrl && (
          <a
            href={resultadosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-purple text-white font-extrabold hover:opacity-95 transition"
          >
            🏁 Ver resultados
          </a>
        )}

        {tipo === "inscripcion" && carreraId && (
          <Link
            href={`/inscribirse?carreraId=${carreraId}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95 transition"
          >
            Inscribirme
          </Link>
        )}
      </div>
    </section>
  );
}
