import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CarreraData } from '@/types/carrera';
import * as XLSX from 'xlsx';

interface CarreraItem extends CarreraData {
  id: string;
}

interface PerfilData {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  celular?: string;
  pais?: string;
  estado?: string;
  ciudad?: string;
  club?: string;
  edad?: number;
}

interface InscripcionItem {
  id: string;
  perfilId: string;
  perfilOwner: string;
  categoria: string;
  timestamp: any;
  perfil: PerfilData | null;
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState<string>('');
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Cargo todas las carreras
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'carreras'));
      setCarreras(
        snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as CarreraData),
        }))
      );
    })();
  }, []);

  // 2) Cuando cambia la carrera, traigo inscripciones + perfil completo
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([]);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const q = query(
          collection(db, 'inscripciones'),
          where('carreraId', '==', selectedCarrera)
        );
        const snap = await getDocs(q);

        const items: InscripcionItem[] = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data()!;
            let perfil: PerfilData | null = null;

            // Perfil principal
            if (data.perfilId === data.perfilOwner) {
              const mainRef = doc(db, 'usuarios', data.perfilOwner);
              const mainSnap = await getDoc(mainRef);
              if (mainSnap.exists()) {
                const m = mainSnap.data() as any;
                perfil = {
                  nombre: m.nombre || '',
                  apellidoPaterno: m.apPaterno ?? m.apellidoPaterno ?? '',
                  apellidoMaterno: m.apMaterno ?? m.apellidoMaterno ?? '',
                  celular: m.celular,
                  pais: m.pais,
                  estado: m.estado,
                  ciudad: m.ciudad,
                  club: m.club,
                  edad: m.edad
                };
              }
            } else {
              // Subperfil
              const subRef = doc(
                db,
                'usuarios',
                data.perfilOwner,
                'perfiles',
                data.perfilId
              );
              const subSnap = await getDoc(subRef);
              if (subSnap.exists()) {
                const s = subSnap.data() as any;
                perfil = {
                  nombre: s.nombre,
                  apellidoPaterno: s.apellidoPaterno,
                  apellidoMaterno: s.apellidoMaterno,
                  celular: s.celular,
                  pais: s.pais,
                  estado: s.estado,
                  ciudad: s.ciudad,
                  club: s.club,
                  edad: s.edad
                };
              }
            }

            return {
              id: d.id,
              perfilId: data.perfilId,
              perfilOwner: data.perfilOwner,
              categoria: data.categoria,
              timestamp: data.timestamp,
              perfil,
            };
          })
        );

        setInscripciones(items);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error al cargar inscripciones');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedCarrera]);

  // Exportar a Excel
  const exportExcel = () => {
    // Mapear datos planos
    const rows = inscripciones.map(i => ({
      Nombre: i.perfil?.nombre,
      ApellidoPaterno: i.perfil?.apellidoPaterno,
      ApellidoMaterno: i.perfil?.apellidoMaterno,
      Edad: i.perfil?.edad,
      Celular: i.perfil?.celular,
      País: i.perfil?.pais,
      Estado: i.perfil?.estado,
      Ciudad: i.perfil?.ciudad,
      Club: i.perfil?.club,
      Categoría: i.categoria,
      Registrado: i.timestamp?.toDate
        ? i.timestamp.toDate().toLocaleString()
        : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inscripciones');
    XLSX.writeFile(wb, `inscripciones_${selectedCarrera}.xlsx`);
  };

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

      {loading && <p>Cargando inscripciones…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {selectedCarrera && !loading && !error && inscripciones.length > 0 && (
        <>
          <button
            onClick={exportExcel}
            className="mb-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Descargar Excel
          </button>

          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Nombre</th>
                <th className="border p-2">Apellido Paterno</th>
                <th className="border p-2">Apellido Materno</th>
                <th className="border p-2">Edad</th>
                <th className="border p-2">Celular</th>
                <th className="border p-2">País</th>
                <th className="border p-2">Estado</th>
                <th className="border p-2">Ciudad</th>
                <th className="border p-2">Club</th>
                <th className="border p-2">Categoría</th>
                <th className="border p-2">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map(i => {
                const p = i.perfil!;
                return (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="border p-2">{p.nombre}</td>
                    <td className="border p-2">{p.apellidoPaterno}</td>
                    <td className="border p-2">{p.apellidoMaterno}</td>
                    <td className="border p-2">{p.edad ?? '-'}</td>
                    <td className="border p-2">{p.celular ?? '-'}</td>
                    <td className="border p-2">{p.pais ?? '-'}</td>
                    <td className="border p-2">{p.estado ?? '-'}</td>
                    <td className="border p-2">{p.ciudad ?? '-'}</td>
                    <td className="border p-2">{p.club ?? '-'}</td>
                    <td className="border p-2">{i.categoria}</td>
                    <td className="border p-2">
                      {i.timestamp?.toDate
                        ? i.timestamp.toDate().toLocaleString()
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {selectedCarrera && !loading && !error && inscripciones.length === 0 && (
        <p className="mt-4 text-gray-500">No hay inscripciones para esta carrera.</p>
      )}
    </div>
  );
}