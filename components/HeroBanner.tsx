export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-dh-border bg-dh-panel shadow-dhSm">
      {/* Overlay suave para contraste (abajo) */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white/90 to-dh-bg/80" />

      {/* ✅ Logo watermark (arriba del overlay) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mi-logo.png"
          alt="DHTime Logo"
          className="w-[78%] max-w-[900px] opacity-[0.10] mix-blend-multiply"
          style={{ filter: "grayscale(5%) contrast(110%)" }}
        />
      </div>

      {/* Contenido */}
      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-dh-ink">
          Bienvenido al mundo donde cada segundo cuenta
        </h1>

        <p className="mt-4 max-w-2xl text-dh-muted text-base sm:text-lg">
          Cronometraje profesional, inscripciones en línea y resultados claros
          para que solo te concentres en competir.
        </p>
      </div>
    </section>
  );
}
