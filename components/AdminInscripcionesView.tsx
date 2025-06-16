import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CarreraData } from '@/types/carrera';

// Extendemos CarreraData para incluir el ID
interface CarreraItem extends CarreraData {
  id: string;
}

// Tipamos las inscripciones
interface InscripcionItem {
  id: string;
  perfilId: string;
  categoria: string;
  timestamp: any;
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState<string>('');
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([]);

  // Carga inicial de carreras
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'carreras'));
      const lista = snap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as CarreraData)
      }));
      setCarreras(lista);
    })();
  }, []);

  // Carga inscripciones cuando cambia la carrera seleccionada
  useEffect(() => {
    if (!selectedCarrera) return;
    (async () => {
      const snap = await getDocs(
        collection(db, 'carreras', selectedCarrera, 'inscripciones')
      );
      const lista = snap.docs.map(doc => ({
        id: doc.id,
        perfilId: doc.data().perfilId,
        categoria: doc.data().categoria,
        timestamp: doc.data().timestamp
      }));
      setInscripciones(lista);
    })();
  }, [selectedCarrera]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Ver Inscripciones</h2>
      <div className="mb-4">
        <label className="block font-medium">Selecciona Carrera:</label>
        <select
          value={selectedCarrera}
          onChange={e => setSelectedCarrera(e.target.value)}
          className="mt-1 border p-2 rounded w-full"
        >
          <option value="">-- Elige una carrera --</option>
          {carreras.map(c => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      </div>
      {inscripciones.length > 0 && (
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Perfil ID</th>
              <th className="border p-2">Categoría</th>
              <th className="border p-2">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {inscripciones.map(ins => (
              <tr key={ins.id}>
                <td className="border p-2">{ins.perfilId}</td>
                <td className="border p-2">{ins.categoria}</td>
                <td className="border p-2">
                  {ins.timestamp?.toDate?.().toLocaleString() || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selectedCarrera && inscripciones.length === 0 && (
        <p className="mt-4 text-center">No hay inscripciones para esta carrera.</p>
      )}
    </div>
  );
}
