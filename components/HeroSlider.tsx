import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  CalendarIcon,
  MapPinIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

type CarreraSlide = {
  type: "carrera";
  id: string;
  titulo: string;
  fecha?: string;
  ubicacion?: string;
  imagenUrl?: string;
  inscripcionesAbiertas?: boolean;
  inscripcionesMensaje?: string;
};

type WelcomeSlide = {
  type: "welcome";
  title: string;
  subtitle: string;
};

type Slide = CarreraSlide | WelcomeSlide;

export default function HeroSlider({
  carreras,
}: {
  carreras: Array<{
    id: string;
    titulo: string;
    fecha?: string;
    ubicacion?: string;
    imagenUrl?: string;
    inscripcionesAbiertas?: boolean;
    inscripcionesMensaje?: string;
    destacado?: boolean;
  }>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const slides: Slide[] = useMemo(() => {
    const welcome: WelcomeSlide = {
      type: "welcome",
      title: "Bienvenido al mundo donde cada segundo cuenta",
      subtitle:
        "Inscríbete en tu próxima carrera, paga en línea y trae tu mejor versión.",
    };

    const carreraSlides: CarreraSlide[] = carreras.map((c) => ({
      type: "carrera",
      id: c.id,
      titulo: c.titulo,
      fecha: c.fecha,
      ubicacion: c.ubicacion,
      imagenUrl: c.imagenUrl,
      inscripcionesAbiertas: c.inscripcionesAbiertas !== false,
      inscripcionesMensaje: c.inscripcionesMensaje || "",
    }));

    return [welcome, ...carreraSlides];
  }, [carreras]);

  useEffect(() => {
    if (paused) return;
    if (slides.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, slides.length]);

  const goTo = (i: number) => setIndex(i);

  const handleClick = (slide: Slide) => {
    if (slide.type !== "carrera") return;

    const abiertas = slide.inscripcionesAbiertas !== false;
    if (!abiertas) return;

    router.push(`/inscribirse?carreraId=${slide.id}`);
  };

  const current = slides[index];
  const isCarrera = current.type === "carrera";
  const abiertas = isCarrera ? current.inscripcionesAbiertas !== false : true;

  const msgPausa =
    isCarrera && !abiertas
      ? (current.inscripcionesMensaje || "").trim() ||
        "Inscripciones pausadas temporalmente."
      : "";

  return (
    <section
      className="w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl border border-dh-border bg-dh-panel shadow-dhSm">
        <div className="relative h-[240px] sm:h-[320px] lg:h-[360px]">
          {/* Fondo */}
          {current.type === "carrera" && current.imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.imagenUrl}
              alt={current.titulo}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-dh-purple/20 via-white to-dh-green/15" />
          )}

          {/* Overlay (para contraste del texto) */}
          <div
  className={`absolute inset-0 ${
    current.type === "welcome" ? "bg-black/10" : "bg-black/35"
  }`}
/>

          {/* ✅ Logo watermark encima del overlay SOLO en welcome */}
          {current.type === "welcome" && (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/mi-logo.png"
    alt="DHTime Logo"
    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
               h-[70%] w-auto max-w-[95%] opacity-[0.28]"
    style={{
      filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.22)) saturate(105%)",
    }}
  />
)}

          {/* Contenido */}
          <button
            type="button"
            onClick={() => handleClick(current)}
            className={`absolute inset-0 flex w-full items-end p-5 sm:p-7 text-left ${
              current.type === "carrera" && abiertas ? "cursor-pointer" : "cursor-default"
            }`}
            title={current.type === "carrera" && !abiertas ? msgPausa : undefined}
          >
            <div className="relative z-10 max-w-3xl">
              {current.type === "welcome" ? (
                <>
                  <p className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                    DHTime • Cronometraje & Eventos
                  </p>
                  <h1 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                    {current.title}
                  </h1>
                  <p className="mt-2 text-sm text-white/85 sm:text-base">
                    {current.subtitle}
                  </p>
                </>
              ) : (
                <>
                  {abiertas ? (
                    <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      <span className="h-2 w-2 rounded-full bg-dh-green" />
                      Inscripciones abiertas
                    </p>
                  ) : (
                    <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      <LockClosedIcon className="h-4 w-4" />
                      Inscripciones pausadas
                    </p>
                  )}

                  <h2 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                    {current.titulo}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/85">
                    {current.fecha ? (
                      <span className="inline-flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5" />
                        {current.fecha}
                      </span>
                    ) : null}

                    {current.ubicacion ? (
                      <span className="inline-flex items-center gap-2">
                        <MapPinIcon className="h-5 w-5" />
                        {current.ubicacion}
                      </span>
                    ) : null}
                  </div>

                  {!abiertas ? (
                    <p className="mt-3 text-sm text-white/85">{msgPausa}</p>
                  ) : (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-dh-purple px-4 py-2 text-sm font-semibold text-white">
                      Inscribirme
                    </div>
                  )}
                </>
              )}
            </div>
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 p-3">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir al slide ${i + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                i === index ? "w-8 bg-dh-purple" : "w-2.5 bg-dh-border"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
