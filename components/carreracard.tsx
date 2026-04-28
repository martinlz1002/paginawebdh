import Link from "next/link";
import Image from "next/image";
import { FC } from "react";
import { motion } from "framer-motion";
import { CalendarIcon, MapPinIcon } from "@heroicons/react/24/outline";

export interface CarreraCardProps {
  id: string;
  slug?: string; // 👈 NUEVO
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: string;
  fechaISO: string;
  imagenUrl?: string;
  resultadosUrl?: string;
  resultadosPublicado?: boolean;
}

const CarreraCard: FC<CarreraCardProps> = ({
  id,
  slug, // 👈 NUEVO
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

  // 🧠 Aquí sucede la magia
  const url = `/carrera/${slug || id}`;

  const content = (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      className="group relative overflow-hidden rounded-3xl bg-black border border-white/10"
    >
      {/* Imagen */}
      {imagenUrl && (
        <div className="relative h-60 overflow-hidden">
          <Image
            src={imagenUrl}
            alt={titulo}
            fill
            className={`object-cover transition-transform duration-700 group-hover:scale-110 ${
              isPast ? "grayscale opacity-70" : ""
            }`}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          {hasResults && (
            <div className="absolute top-4 left-4 bg-dh-green text-black text-xs font-bold px-4 py-1 rounded-full shadow-lg">
              RESULTADOS
            </div>
          )}

          {isPast && !hasResults && (
            <div className="absolute top-4 left-4 bg-white/20 backdrop-blur px-4 py-1 text-xs font-semibold text-white rounded-full">
              Finalizada
            </div>
          )}
        </div>
      )}

      {/* Contenido */}
      <div className="p-6 text-white space-y-4">
        <h2 className="text-2xl font-black leading-tight">{titulo}</h2>

        <div className="flex flex-wrap gap-6 text-white/60 text-sm">
          <span className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {fecha}
          </span>

          {ubicacion && (
            <span className="flex items-center gap-2">
              <MapPinIcon className="w-5 h-5" />
              {ubicacion}
            </span>
          )}
        </div>

        {descripcion && (
          <p className="text-white/70 text-sm line-clamp-2">
            {descripcion}
          </p>
        )}

        <div className="pt-4">
          {hasResults ? (
            <span className="text-dh-green font-bold text-sm">
              Ver resultados oficiales →
            </span>
          ) : (
            <span className="text-white/80 text-sm group-hover:text-dh-green transition">
              Ver detalles →
            </span>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-dh-purple to-dh-green group-hover:w-full transition-all duration-500" />
    </motion.div>
  );

  if (hasResults) {
    return (
      <a
        href={resultadosUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={url} className="block">
      {content}
    </Link>
  );
};

export default CarreraCard;