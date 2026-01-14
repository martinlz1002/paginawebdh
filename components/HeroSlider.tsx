import { useEffect, useState } from "react";
import HeroBanner from "./HeroBanner";

export interface CarreraHero {
  id: string;
  titulo: string;
  fecha: string;
  imagenUrl?: string;

  inscripcionesAbiertas?: boolean;

  resultados?: {
    url?: string;
    publicado?: boolean;
  };

  carreraDate?: Date;
}

export default function HeroSlider({ carreras }: { carreras: CarreraHero[] }) {
  const [index, setIndex] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 🔥 mezcla inscripciones + resultados
  const slides = [
    ...carreras
      .filter((c) => c.carreraDate && c.carreraDate >= today)
      .slice(0, 3)
      .map((c) => ({
        tipo: "inscripcion" as const,
        ...c,
      })),

    ...carreras
      .filter(
        (c) =>
          c.carreraDate &&
          c.carreraDate < today &&
          c.resultados?.publicado === true &&
          c.resultados.url
      )
      .slice(0, 2)
      .map((c) => ({
        tipo: "resultados" as const,
        ...c,
      })),
  ];

  useEffect(() => {
    if (slides.length <= 1) return;

    const t = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 6000);

    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const c = slides[index];

  return (
    <HeroBanner
      tipo={c.tipo}
      titulo={c.titulo}
      subtitulo={c.tipo === "resultados" ? "Carrera finalizada" : c.fecha}
      imagenUrl={c.imagenUrl}
      carreraId={c.tipo === "inscripcion" ? c.id : undefined}
      resultadosUrl={c.tipo === "resultados" ? c.resultados?.url : undefined}
    />
  );
}
