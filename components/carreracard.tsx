import Link from "next/link";
import Image from "next/image";
import { FC } from "react";

export interface CarreraCardProps {
  id: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;

  // visual
  fecha: string;        // texto formateado (DD/MM/YYYY)
  fechaISO: string;     // YYYY-MM-DD o timestamp

  imagenUrl?: string;

  // resultados
  resultadosUrl?: string;
  resultadosPublicado?: boolean;
}

const CarreraCard: FC<CarreraCardProps> = ({
  id,
  titulo,
  descripcion,
  ubicacion,
  fecha,
  fechaISO,
  imagenUrl,
  resultadosUrl,
  resultadosPublicado,
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const carreraDate = new Date(fechaISO);
  const isPast = carreraDate < today;
  const hasResults = isPast && resultadosPublicado && !!resultadosUrl;

  const Wrapper = hasResults ? "a" : "div";
  const wrapperProps = hasResults
    ? {
        href: resultadosUrl!,
        target: "_blank",
        rel: "noopener noreferrer",
      }
    : {};

  return (
    <Link href={!hasResults ? `/carrera/${id}` : "#"} passHref>
      <a className="block group bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200 relative">
        {/* Imagen */}
        {imagenUrl && (
          <div className="h-48 relative overflow-hidden">
            <Image
              src={imagenUrl}
              alt={titulo}
              layout="fill"
              objectFit="cover"
              className={isPast ? "grayscale opacity-80" : ""}
            />

            {/* Overlay RESULTADOS */}
            {hasResults && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <span className="text-white text-3xl font-black tracking-widest rotate-[-12deg] opacity-90 select-none">
                  RESULTADOS
                </span>
              </div>
            )}

            {/* Badge finalizada sin resultados */}
            {isPast && !hasResults && (
              <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-full">
                Finalizada
              </div>
            )}
          </div>
        )}

        {/* Contenido */}
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-1 text-dh-ink">
            {titulo}
          </h2>

          {ubicacion && (
            <p className="text-gray-600 text-sm mb-1">
              <strong>Ubicación:</strong> {ubicacion}
            </p>
          )}

          <p className="text-gray-600 text-sm mb-2">
            <strong>Fecha:</strong> {fecha}
          </p>

          {descripcion && (
            <p className="text-gray-700 text-base">
              {descripcion}
            </p>
          )}

          {/* CTA resultados */}
          {hasResults && (
            <p className="mt-3 text-sm font-bold text-dh-green">
              🏁 Ver resultados oficiales
            </p>
          )}
        </div>
      </a>
    </Link>
  );
};

export default CarreraCard;
