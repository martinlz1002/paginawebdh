import Link from "next/link";

export default function HeroBanner() {
  return (
    <section className="relative bg-gradient-to-br from-green-600 to-green-400 text-white rounded-2xl overflow-hidden mb-12">
      <div className="absolute inset-0 opacity-20 bg-[url('/banner-bg.jpg')] bg-cover bg-center" />
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 flex flex-col items-center text-center">
        <h1 className="text-5xl font-extrabold mb-4">
          ¡Bienvenido a DH Time!
        </h1>
        <p className="text-lg mb-8 max-w-xl">
          Inscríbete en tus carreras favoritas, gestiona tu perfil y consulta tus inscripciones de manera fácil y rápida.
        </p>
        <div className="space-x-4">
          <Link href="/inscribirse">
            <a className="px-8 py-3 bg-white text-green-700 font-semibold rounded-full shadow hover:bg-gray-100 transition">
              Inscribirme
            </a>
          </Link>
          <Link href="/mis-inscripciones">
            <a className="px-8 py-3 border-2 border-white font-semibold rounded-full hover:bg-white hover:text-green-700 transition">
              Mis Inscripciones
            </a>
          </Link>
        </div>
      </div>
    </section>
);
}