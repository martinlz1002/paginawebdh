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
  <div className="min-h-screen bg-[#0c0c0f] py-12 px-6 text-white">
    <div className="max-w-xl mx-auto">

      <div className="bg-[#16161d] border border-red-500/20 rounded-3xl p-8 space-y-6">

        <div>
          <h2 className="text-2xl font-black text-red-400">
            Eliminar Inscripciones
          </h2>
          <p className="text-sm text-white/50 mt-2">
            Esta acción eliminará permanentemente los registros de la carrera seleccionada.
          </p>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-400 text-sm font-medium">
            {feedback}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-white/70">
            Carrera
          </label>

          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loading}
            className="mt-2 w-full bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
          >
            <option value="">Selecciona una carrera</option>
            {carreras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleClick}
          disabled={!selectedId || loading}
          className="w-full rounded-2xl bg-red-600 py-4 font-extrabold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Borrando..." : "Eliminar inscripciones"}
        </button>

        <div className="text-xs text-white/40">
          Tip: esto borra registros en <code className="text-white/70">inscripciones</code> para esa carrera.
        </div>

      </div>
    </div>
  </div>
);
}
