import Link from "next/link";

export default function NosotrosPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4 space-y-8">
      <h1 className="text-4xl font-bold text-purple-800">Sobre Nosotros</h1>
      <p className="text-gray-700">
        En <strong>DHTime</strong> organizamos carreras deportivas con la máxima calidad y seguridad. 
        Nuestro objetivo es fomentar la salud y el deporte en la comunidad.
      </p>
      <h2 className="text-2xl font-semibold text-purple-700">Nuestra Misión</h2>
      <p className="text-gray-700">
        Crear experiencias inolvidables para corredores de todos los niveles, promoviendo el bienestar y el compañerismo.
      </p>
      <h2 className="text-2xl font-semibold text-purple-700">Nuestros Valores</h2>
      <ul className="list-disc list-inside text-gray-700 space-y-1">
        <li>Pasión por el deporte</li>
        <li>Calidad y seguridad</li>
        <li>Respeto al medio ambiente</li>
        <li>Compromiso con la comunidad</li>
      </ul>
      <Link 
      href="/" 
      className="inline-block bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
      >
          Volver al inicio
      </Link>
    </div>
  );
}