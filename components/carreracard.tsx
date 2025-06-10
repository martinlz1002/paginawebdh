import React from 'react';

interface CarreraCardProps {
  nombre: string;
  fecha: string;
  lugar: string;
  descripcion?: string;
}

export default function CarreraCard({ nombre, fecha, lugar, descripcion }: CarreraCardProps) {
  return (
    <div className="border rounded-2xl p-4 shadow-md bg-white hover:shadow-lg transition-all">
      <h2 className="text-xl font-bold text-blue-700">{nombre}</h2>
      <p className="text-sm text-gray-500">{fecha} • {lugar}</p>
      {descripcion && <p className="mt-2 text-gray-700">{descripcion}</p>}
    </div>
  );
}