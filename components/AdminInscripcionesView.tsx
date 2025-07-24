import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  Timestamp
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
  perfil: PerfilData;
  categoria: string;
  timestamp: Date;
  sessionId?: string | null;
  payment_status?: string;
  competitorNumber: number;
}

type RawData = Record<string, any>;

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState('');
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargo la lista de carreras
  useEffect(() => {
    getDocs(collection(db, 'carreras')).then(snap => {
      setCarreras(
        snap.docs.map(d => ({ id: d.id, ...(d.data() as CarreraData) }))
      );
    });
  }, []);

  // Cuando cambia la carrera, cargo inscripciones
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([]);
      return;
    }
    setLoading(true);

    (async () => {
      // consulta inscripciones
      const snap = await getDocs(
        query(
          collection(db, 'inscripciones'),
          where('carreraId', '==', selectedCarrera)
        )
      );

      // info de la carrera seleccionada
      const carreraInfo = carreras.find(c => c.id === selectedCarrera);

      const items: InscripcionItem[] = await Promise.all(
        snap.docs.map(async d => {
          const raw = d.data() as RawData;

          // perfil
          const perfil: PerfilData = {
            nombre: '',
            apellidoPaterno: '',
            apellidoMaterno: ''
          };

          if (raw.perfilOwner === 'manual') {
            // manual
            perfil.nombre = raw.perfilNombre || '';
            perfil.apellidoPaterno = raw.perfilApPaterno || '';
            perfil.apellidoMaterno = raw.perfilApMaterno || '';
            perfil.celular = raw.celular;
            perfil.ciudad = raw.ciudad;
            perfil.estado = raw.estado;
            perfil.pais = raw.pais;
            perfil.club = raw.club;

            // calcular edad según fecha de la carrera o fin de año
            if (raw.birthDate && carreraInfo) {
              const bd: Date =
                raw.birthDate instanceof Timestamp
                  ? raw.birthDate.toDate()
                  : new Date(raw.birthDate);
              // basis
              const year = new Date(carreraInfo.fecha!).getFullYear();
              const basis =
                carreraInfo.ageBasis === 'eventDate'
                  ? new Date(carreraInfo.fecha!)
                  : new Date(year, 11, 31);
              let age = basis.getFullYear() - bd.getFullYear();
              const m = basis.getMonth() - bd.getMonth();
              if (m < 0 || (m === 0 && basis.getDate() < bd.getDate())) {
                age--;
              }
              perfil.edad = age;
            }
          } else {
            // pago via Stripe
            if (raw.perfilId === raw.perfilOwner) {
              // principal
              const main = await getDoc(doc(db, 'usuarios', raw.perfilOwner));
              if (main.exists()) {
                const m = main.data() as any;
                perfil.nombre = m.nombre || '';
                perfil.apellidoPaterno = m.apPaterno || m.apellidoPaterno || '';
                perfil.apellidoMaterno = m.apMaterno || m.apellidoMaterno || '';
                perfil.celular = m.celular;
                perfil.pais = m.pais;
                perfil.estado = m.estado;
                perfil.ciudad = m.ciudad;
                perfil.club = m.club;
                perfil.edad = m.edad;
              }
            } else {
              // subperfil
              const sub = await getDoc(
                doc(db, 'usuarios', raw.perfilOwner, 'perfiles', raw.perfilId)
              );
              if (sub.exists()) {
                const s = sub.data() as any;
                perfil.nombre = s.nombre || '';
                perfil.apellidoPaterno = s.apPaterno || s.apellidoPaterno || '';
                perfil.apellidoMaterno = s.apMaterno || s.apellidoMaterno || '';
                perfil.celular = s.celular;
                perfil.pais = s.pais;
                perfil.estado = s.estado;
                perfil.ciudad = s.ciudad;
                perfil.club = s.club;
                perfil.edad = s.edad;
              }
            }
          }

          // payment_status
          let payment_status: string | undefined = raw.paymentStatus;
          if (!payment_status && raw.sessionId) {
            try {
              const res = await fetch(
                `/api/get-session?session_id=${raw.sessionId}`
              );
              if (res.ok) {
                const js = await res.json();
                payment_status = js.payment_status;
              }
            } catch {
              /* ignore */
            }
          }

          // timestamp
          let ts = new Date();
          if (raw.timestamp instanceof Timestamp) {
            ts = raw.timestamp.toDate();
          } else if (raw.timestamp?.toDate) {
            ts = raw.timestamp.toDate();
          } else if (typeof raw.timestamp === 'string') {
            ts = new Date(raw.timestamp);
          }

          // número
          const num: number =
            typeof raw.competitorNumber === 'number'
              ? raw.competitorNumber
              : Number(raw.competitorNumber) || 0;

          return {
            id: d.id,
            perfil,
            categoria: raw.categoria || '',
            timestamp: ts,
            sessionId: raw.sessionId ?? null,
            payment_status,
            competitorNumber: num
          };
        })
      );

      // ordenar ascendente por competitorNumber
      items.sort(
        (a, b) => a.competitorNumber - b.competitorNumber
      );

      setInscripciones(items);
      setLoading(false);
    })();
  }, [selectedCarrera, carreras]);

  // export Excel
  const exportExcel = () => {
    const rows = inscripciones.map(i => ({
      Número: i.competitorNumber,
      Nombre: i.perfil.nombre,
      ApellidoP: i.perfil.apellidoPaterno,
      ApellidoM: i.perfil.apellidoMaterno,
      Edad: i.perfil.edad ?? '',
      Celular: i.perfil.celular ?? '',
      Categoría: i.categoria,
      EstadoPago: i.payment_status ?? 'desconocido',
      Registrado: i.timestamp.toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inscripciones');
    XLSX.writeFile(wb, `inscripciones_${selectedCarrera}.xlsx`);
  };

  return (
    <div className="p-6">
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
                <th className="p-2 text-left">Número</th>
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
                  <td className="p-2">{i.competitorNumber}</td>
                  <td className="p-2">{i.perfil.nombre}</td>
                  <td className="p-2">{i.perfil.apellidoPaterno}</td>
                  <td className="p-2">{i.perfil.apellidoMaterno}</td>
                  <td className="p-2">{i.perfil.edad ?? '-'}</td>
                  <td className="p-2">{i.perfil.celular ?? '-'}</td>
                  <td className="p-2">{i.categoria}</td>
                  <td className="p-2">{i.payment_status ?? '-'}</td>
                  <td className="p-2">{i.timestamp.toLocaleString()}</td>
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