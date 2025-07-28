import { useEffect, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { CalendarIcon, MapPinIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: string;
  imagenUrl?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export default function HomePage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);

  useEffect(() => {
    (async () => {
      const snapshot = await getDocs(collection(db, 'carreras'));
      const hoy = new Date();
      const today = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

      const data = snapshot.docs
        .map((doc) => {
          const c = doc.data() as any;
          let fechaFormateada = '';
          let carreraDate: Date | null = null;

          if (c.fecha instanceof Timestamp) {
            const dt = c.fecha.toDate();
            carreraDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
            fechaFormateada = `${pad(carreraDate.getDate())}/${pad(carreraDate.getMonth() + 1)}/${carreraDate.getFullYear()}`;
          } else if (typeof c.fecha === 'string') {
            const [y, m, d] = c.fecha.split('-').map(Number);
            carreraDate = new Date(y, m - 1, d);
            fechaFormateada = `${pad(d)}/${pad(m)}/${y}`;
          }

          return {
            id: doc.id,
            titulo: c.titulo,
            descripcion: c.descripcion,
            ubicacion: c.ubicacion,
            fecha: fechaFormateada,
            imagenUrl: c.imagenUrl,
            carreraDate,
          } as Carrera & { carreraDate: Date | null };
        })
        .filter((c): c is Carrera & { carreraDate: Date } => c.carreraDate !== null && c.carreraDate >= today)
        .map(({ carreraDate, ...rest }) => rest);

      setCarreras(data);
    })();
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-4xl font-extrabold text-center text-green-800">
        Próximas Carreras
      </h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {carreras.map((c) => (
          <Link key={c.id} href={`/inscribirse?carreraId=${c.id}`}>
            <a className="block bg-white rounded-2xl shadow-md overflow-hidden transition-transform hover:scale-105 hover:shadow-xl">
              <div className="aspect-w-16 aspect-h-9 bg-gray-100">
                {c.imagenUrl ? (
                  <img
                    src={c.imagenUrl}
                    alt={c.titulo}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center text-gray-400">
                    Sin imagen
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <h3 className="text-xl font-semibold text-gray-800">
                  {c.titulo}
                </h3>
                {c.descripcion && (
                  <p className="text-gray-600 line-clamp-3">
                    {c.descripcion}
                  </p>
                )}
                <div className="flex items-center text-gray-500 text-sm space-x-4">
                  <time className="flex items-center space-x-1">
                    <CalendarIcon className="w-5 h-5" />
                    <span>{c.fecha}</span>
                  </time>
                  {c.ubicacion && (
                    <span className="flex items-center space-x-1">
                      <MapPinIcon className="w-5 h-5" />
                      <span>{c.ubicacion}</span>
                    </span>
                  )}
                </div>
                <div className="flex justify-end">
                  <button className="inline-flex items-center space-x-1 text-green-700 font-medium hover:text-green-800">
                    <span>Inscribirse</span>
                    <ArrowRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </a>
          </Link>
        ))}
      </div>
    </main>
  );
}
