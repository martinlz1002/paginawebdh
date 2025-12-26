import Link from "next/link";
import { CalendarIcon } from "@heroicons/react/24/outline";

interface Carrera {
  id: string;
  titulo: string;
  fecha: string;
  imagenUrl: string;
  destacado?: boolean;
}

export default function FeaturedCarreras({ carreras }: { carreras: Carrera[] }) {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-extrabold text-white text-center">
        Carreras <span className="text-dh-green">Destacadas</span>
      </h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {carreras
          .filter((c) => c.destacado)
          .map((c) => (
            <Link key={c.id} href={`/inscribirse?carreraId=${c.id}`}>
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
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Overlay oscuro para contraste */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                {/* Contenido */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {c.titulo}
                  </h3>
                  <p className="flex items-center text-sm text-white/80">
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    {c.fecha}
                  </p>
                </div>

                {/* Glow sutil en hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition pointer-events-none ring-1 ring-dh-green/30 rounded-2xl" />
              </a>
            </Link>
          ))}
      </div>
    </section>
  );
}
