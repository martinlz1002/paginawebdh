import React, { useState } from "react";

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
  feedback,
}: EliminarInscripcionesProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    if (!selectedId || loading) return;

    const ok = window.confirm(
      "¿Eliminar TODAS las inscripciones de esta carrera?\n\nEsta acción no se puede deshacer."
    );
    if (!ok) return;

    try {
      await onDelete(selectedId);
      setSelectedId(""); // opcional: limpia selección
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "No se pudieron eliminar las inscripciones.");
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-gray-800 text-2xl font-semibold mb-4">
        Eliminar Inscripciones
      </h2>

      {feedback && <p className="mb-4 text-green-700">{feedback}</p>}
      {error && <p className="mb-4 text-red-700">{error}</p>}

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full p-2 border rounded mb-4"
        disabled={loading}
      >
        <option value="">Selecciona una carrera</option>
        {carreras.map((c) => (
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
        {loading ? "Borrando..." : "Eliminar inscripciones"}
      </button>

      <p className="text-xs text-gray-500 mt-3">
        Tip: esto borra registros en <code>inscripciones</code> para esa carrera.
      </p>
    </div>
  );
}
