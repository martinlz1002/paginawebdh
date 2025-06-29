import React, { useState } from 'react';

export interface CarreraOption {
  id: string;
  titulo: string;
}

interface EliminarInscripcionesProps {
  carreras: CarreraOption[];
  onDelete: (carreraId: string) => Promise<void>;
  loading: boolean;
  feedback?: string | null;
}

export default function EliminarInscripciones({
  carreras,
  onDelete,
  loading,
  feedback
}: EliminarInscripcionesProps) {
  const [selectedId, setSelectedId] = useState<string>('');

  const handleClick = () => {
    if (!selectedId) return;
    onDelete(selectedId);
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-2xl font-semibold mb-4">Eliminar Inscripciones</h2>
      {feedback && <p className="mb-4 text-green-700">{feedback}</p>}
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      >
        <option value="">Selecciona una carrera</option>
        {carreras.map(c => (
          <option key={c.id} value={c.id}>
            {c.titulo}
          </option>
        ))}
      </select>
      <button
        onClick={handleClick}
        disabled={!selectedId || loading}
        className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Borrando...' : 'Eliminar inscripciones'}
      </button>
    </div>
  );
}