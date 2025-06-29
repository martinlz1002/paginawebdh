import Link from 'next/link';
import Image from 'next/image';
import { FC } from 'react';

export interface CarreraCardProps {
  id: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: string;
  imagenUrl?: string;
}

const CarreraCard: FC<CarreraCardProps> = ({ id, titulo, descripcion, ubicacion, fecha, imagenUrl }) => (
  <Link href={`/carrera/${id}`}>
    <a className="block bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
      {imagenUrl && (
        <div className="h-48 relative">
          <Image src={imagenUrl} alt={titulo} layout="fill" objectFit="cover" />
        </div>
      )}
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-1">{titulo}</h2>
        {ubicacion && <p className="text-gray-600 text-sm mb-1"><strong>Ubicación:</strong> {ubicacion}</p>}
        <p className="text-gray-600 text-sm mb-2"><strong>Fecha:</strong> {fecha}</p>
        {descripcion && <p className="text-gray-700 text-base">{descripcion}</p>}
      </div>
    </a>
  </Link>
);

export default CarreraCard;