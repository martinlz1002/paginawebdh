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
  slug,
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

  const url = `/carrera/${slug || id}`;

  const content = (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.25 }}
      className="group relative overflow-hidden rounded-3xl bg-dh-surface border border-white/5 shadow-dhSoft"
    >

      {/* 🌫️ Glow sutil */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-dh-glow" />

      {/* 🖼️ Imagen */}
      {imagenUrl && (
        <div className="relative h-64 overflow-hidden">
          <Image
            src={imagenUrl}
            alt={titulo}
            fill
            className={`object-cover transition-transform duration-700 group-hover:scale-110 ${
              isPast ? "grayscale opacity-60" : ""
            }`}
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          {/* 🏷️ Badge */}
          {hasResults && (
            <div className="absolute top-4 left-4 bg-gradient-to-r from-dh-purple to-dh-purpleLight text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
              RESULTADOS
            </div>
          )}

          {isPast && !hasResults && (
            <div className="absolute top-4 left-4 bg-white/10 backdrop-blur px-4 py-1 text-xs font-semibold text-white rounded-full border border-white/10">
              Finalizada
            </div>
          )}
        </div>
      )}

      {/* 📦 CONTENIDO */}
      <div className="p-6 space-y-5">

        {/* Título */}
        <h2 className="text-2xl font-black leading-tight text-white/95 group-hover:text-white transition">
          {titulo}
        </h2>

        {/* Info */}
        <div className="flex flex-wrap gap-5 text-white/60 text-sm">
          <span className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-dh-purple" />
            {fecha}
          </span>

          {ubicacion && (
            <span className="flex items-center gap-2">
              <MapPinIcon className="w-5 h-5 text-dh-purple" />
              {ubicacion}
            </span>
          )}
        </div>

        {/* Descripción */}
        {descripcion && (
          <p className="text-white/60 text-sm leading-relaxed line-clamp-2">
            {descripcion}
          </p>
        )}

        {/* CTA */}
        <div className="pt-3 flex items-center justify-between">

          {hasResults ? (
            <span className="text-dh-purple font-semibold text-sm">
              Ver resultados →
            </span>
          ) : (
            <span className="text-white/70 text-sm group-hover:text-dh-purple transition">
              Ver detalles →
            </span>
          )}

          {/* 👉 Mini indicador visual */}
          <div className="w-2 h-2 rounded-full bg-dh-purple opacity-0 group-hover:opacity-100 transition" />
        </div>
      </div>

      {/* 🔥 Línea animada inferior */}
      <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-dh-purple to-dh-purpleLight group-hover:w-full transition-all duration-500" />
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