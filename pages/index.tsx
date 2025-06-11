import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const noticias = [
    {
      id: 1,
      titulo: '¡Inscripciones abiertas para la Carrera 5K Primavera!',
      contenido: 'Participa en nuestra próxima carrera 5K este 25 de junio.'
    },
    {
      id: 2,
      titulo: 'Nuevo patrocinador oficial: Deportes Elite',
      contenido: 'Gracias al nuevo patrocinio, habrá premios exclusivos para los ganadores.'
    }
  ];

  const carreras = [
    {
      id: 1,
      nombre: 'Carrera 5K Primavera',
      fecha: '25 de junio, 2025',
      lugar: 'Parque Central, Ciudad XYZ'
    },
    {
      id: 2,
      nombre: 'Carrera 10K Verano',
      fecha: '15 de julio, 2025',
      lugar: 'Malecón, Ciudad ABC'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="flex items-center justify-between px-6 py-4 shadow-md bg-white">
        <h1 className="text-2xl font-bold text-green-700">Cronometraje App</h1>
        <Link href="/login" className="text-sm font-medium text-purple-600 hover:underline">Iniciar sesión</Link>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 text-purple-700">Noticias</h2>
          <div className="space-y-4">
            {noticias.map(noticia => (
              <div key={noticia.id} className="p-4 bg-white rounded-xl shadow border border-gray-200">
                <h3 className="font-semibold text-lg text-green-700">{noticia.titulo}</h3>
                <p className="text-sm mt-1 text-gray-600">{noticia.contenido}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-purple-700">Próximas Carreras</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {carreras.map(carrera => (
              <div key={carrera.id} className="bg-white p-5 rounded-xl shadow border border-gray-200 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-green-800">{carrera.nombre}</h3>
                  <p className="text-sm text-gray-600">{carrera.fecha}</p>
                  <p className="text-sm text-gray-600">{carrera.lugar}</p>
                </div>
                <Link
                  href={`/inscribirse?id=${carrera.id}`}
                  className="mt-4 inline-block bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple-700 text-center"
                >
                  Inscribirme
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}