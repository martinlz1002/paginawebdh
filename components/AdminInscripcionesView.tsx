// components/AdminInscripcionesView.tsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  DocumentData,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as XLSX from "xlsx";

interface CarreraOption {
  id: string;
  titulo: string;
}

interface Inscripcion {
  perfilId: string;
  categoria: string;
  timestamp: any;
  [key: string]: any; // para incluir cualquier otro campo que guardes
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [selCarrera, setSelCarrera] = useState<string>("");
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [loading, setLoading] = useState(false);

  // Carga las carreras disponibles
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));
      setCarreras(
        snap.docs.map((d) => ({
          id: d.id,
          titulo: d.data().titulo,
        }))
      );
    })();
  }, []);

  // Cada vez que cambie la carrera seleccionada, recarga las inscripciones
  useEffect(() => {
    if (!selCarrera) {
      setInscripciones([]);
      return;
    }
    setLoading(true);
    (async () => {
      const q = query(
        collection(db, "inscripciones"),
        where("carreraId", "==", selCarrera)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({
        ...(d.data() as DocumentData),
        timestamp: d.data().timestamp || serverTimestamp(),
      })) as Inscripcion[];
      setInscripciones(data);
      setLoading(false);
    })();
  }, [selCarrera]);

  // Genera y dispara la descarga de Excel
  const descargarExcel = () => {
    if (inscripciones.length === 0) return alert("No hay inscripciones para exportar.");
    // Prepara datos plano para Excel
    const rows = inscripciones.map((ins) => ({
      "Perfil ID": ins.perfilId,
      "Categoría": ins.categoria,
      Fecha: ins.timestamp?.toDate?.().toLocaleDateString() || "",
      Hora: ins.timestamp?.toDate?.().toLocaleTimeString() || "",
      // si tienes más campos, agrégalos aquí...
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inscripciones");
    XLSX.writeFile(wb, `inscripciones_${selCarrera}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Ver Inscripciones</h2>

      <div className="flex items-center gap-4">
        <label className="font-medium">Carrera:</label>
        <select
          className="border p-2 rounded"
          value={selCarrera}
          onChange={(e) => setSelCarrera(e.target.value)}
        >
          <option value="">-- Selecciona --</option>
          {carreras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
        {inscripciones.length > 0 && (
          <button
            onClick={descargarExcel}
            className="ml-auto bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Descargar Excel
          </button>
        )}
      </div>

      {loading && <p>Cargando inscripciones…</p>}

      {!loading && inscripciones.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2">Perfil ID</th>
                <th className="border p-2">Categoría</th>
                <th className="border p-2">Fecha</th>
                <th className="border p-2">Hora</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((ins, idx) => {
                const dt = ins.timestamp?.toDate?.();
                return (
                  <tr key={idx}>
                    <td className="border p-2">{ins.perfilId}</td>
                    <td className="border p-2">{ins.categoria}</td>
                    <td className="border p-2">
                      {dt ? dt.toLocaleDateString() : ""}
                    </td>
                    <td className="border p-2">
                      {dt ? dt.toLocaleTimeString() : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && selCarrera && inscripciones.length === 0 && (
        <p>No hay inscripciones para esta carrera.</p>
      )}
    </div>
  );
}