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
      <h2 className="text-2xl font-extrabold text-dh-purple">Carreras Destacadas <span className="text-dh-green"></span></h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {carreras
          .filter(c => c.destacado)
          .map((c) => (
            <Link key={c.id} href={`/inscribirse?carreraId=${c.id}`}>
              <a className="block bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-dh transition border border-dh-purple/10">
                <div className="h-48 bg-gray-100 overflow-hidden">
                  <img
                    src={c.imagenUrl}
                    alt={c.titulo}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="text-lg font-semibold text-gray-800">{c.titulo}</h3>
                  <p className="flex items-center text-gray-600 text-sm">
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    {c.fecha}
                  </p>
                </div>
              </a>
            </Link>
          ))}
      </div>
    </section>
  );
}