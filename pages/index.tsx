// pages/index.tsx
import { GetServerSideProps } from "next";
import { getCarreras } from "@/lib/getCarreras";
import Link from "next/link";

type Carrera = {
  id: string;
  titulo: string;
  fecha: string;
  ubicacion: string;
  descripcion: string;
};

export default function Home({ carreras }: { carreras: Carrera[] }) {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Próximas Carreras</h1>
      <div className="grid gap-4">
        {carreras.map((carrera) => (
          <div key={carrera.id} className="border p-4 rounded shadow-md">
            <h2 className="text-xl font-semibold">{carrera.titulo}</h2>
            <p className="text-sm text-gray-600">{carrera.fecha} - {carrera.ubicacion}</p>
            <p className="mt-2">{carrera.descripcion}</p>
            <Link href={`/carrera/${carrera.id}`} className="mt-3 inline-block text-green-700 hover:underline">
              Ver más / Inscribirse →
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const carreras = await getCarreras();
  return {
    props: {
      carreras,
    },
  };
};