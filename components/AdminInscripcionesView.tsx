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
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface CarreraItem extends CarreraData { id: string; }
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
  perfil: PerfilData | null;
  categoria: string;
  timestamp: any;
  sessionId?: string;            // <— debe venir guardado en Firestore
  payment_status?: string;       // <— lo rellenamos abajo
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState('');
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 1) Cargo carreras
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'carreras'));
      setCarreras(snap.docs.map(d => ({ id: d.id, ...(d.data() as CarreraData) })));
    })();
  }, []);

  // 2) Cargo inscripciones + perfil + sessionId
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([]);
      return;
    }
    setLoading(true);
    (async () => {
      const q = query(
        collection(db, 'inscripciones'),
        where('carreraId', '==', selectedCarrera)
      );
      const snap = await getDocs(q);

      const items: InscripcionItem[] = await Promise.all(
        snap.docs.map(async d => {
          const data = d.data()!;
          // → cargar perfil idéntico a antes…
          let perfil: PerfilData | null = null;
          if (data.perfilId === data.perfilOwner) {
            const main = await getDoc(doc(db, 'usuarios', data.perfilOwner));
            if (main.exists()) {
              const m = main.data() as any;
              perfil = {
                nombre: m.nombre,
                apellidoPaterno: m.apPaterno || m.apellidoPaterno,
                apellidoMaterno: m.apMaterno || m.apellidoMaterno,
                celular: m.celular,
                pais: m.pais,
                estado: m.estado,
                ciudad: m.ciudad,
                club: m.club,
                edad: m.edad
              };
            }
          } else {
            const sub = await getDoc(
              doc(db, 'usuarios', data.perfilOwner, 'perfiles', data.perfilId)
            );
            if (sub.exists()) {
              const s = sub.data() as any;
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
            perfil,
            categoria: data.categoria,
            timestamp: data.timestamp,
            sessionId: (data as any).sessionId  // <— aquí el campo
          };
        })
      );

      // 3) Consultar Stripe para cada sessionId
      const withStatus = await Promise.all(
        items.map(async item => {
          if (!item.sessionId) return item;
          try {
            const res = await fetch(`/api/get-session?session_id=${item.sessionId}`);
            if (res.ok) {
              const json = await res.json();
              return { ...item, payment_status: json.payment_status };
            }
          } catch {
            // silenciar errores individuales
          }
          return item;
        })
      );

      setInscripciones(withStatus);
      setLoading(false);
    })();
  }, [selectedCarrera]);

  // 4) Exportar Excel incluyendo estado de pago
  const exportExcel = () => {
    const rows = inscripciones.map(i => ({
      Nombre: i.perfil?.nombre,
      ApellidoP: i.perfil?.apellidoPaterno,
      ApellidoM: i.perfil?.apellidoMaterno,
      Edad: i.perfil?.edad,
      Celular: i.perfil?.celular,
      Categoría: i.categoria,
      EstadoPago: i.payment_status ?? 'desconocido',
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
      {/* Header y botón export */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Ver Inscripciones</h2>
        <button
          onClick={exportExcel}
          disabled={!inscripciones.length}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <ArrowDownTrayIcon className="w-5 h-5" />
          <span>Exportar Excel</span>
        </button>
      </div>

      {/* Selector de carrera */}
      <select
        value={selectedCarrera}
        onChange={e => setSelectedCarrera(e.target.value)}
        className="w-full border p-2 rounded mb-6"
      >
        <option value="">-- Elige una carrera --</option>
        {carreras.map(c => (
          <option key={c.id} value={c.id}>
            {c.titulo}
          </option>
        ))}
      </select>

      {loading ? (
        <p>Cargando inscripciones…</p>
      ) : inscripciones.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse rounded-lg shadow">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Apellido P</th>
                <th className="p-2 text-left">Apellido M</th>
                <th className="p-2 text-left">Edad</th>
                <th className="p-2 text-left">Celular</th>
                <th className="p-2 text-left">Categoría</th>
                <th className="p-2 text-left">Estado Pago</th>
                <th className="p-2 text-left">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="p-2">{i.perfil?.nombre}</td>
                  <td className="p-2">{i.perfil?.apellidoPaterno}</td>
                  <td className="p-2">{i.perfil?.apellidoMaterno}</td>
                  <td className="p-2">{i.perfil?.edad}</td>
                  <td className="p-2">{i.perfil?.celular}</td>
                  <td className="p-2">{i.categoria}</td>
                  <td className="p-2 capitalize">{i.payment_status || '-'}</td>
                  <td className="p-2">
                    {i.timestamp?.toDate
                      ? i.timestamp.toDate().toLocaleString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedCarrera ? (
        <p className="text-gray-500">No hay inscripciones para esta carrera.</p>
      ) : null}
    </div>
  );
}