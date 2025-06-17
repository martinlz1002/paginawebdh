import React, { useEffect, useState } from 'react';
import {
  collection,
  collectionGroup,
  getDoc,
  getDocs,
  query,
  where,
  doc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CarreraData } from '@/types/carrera';

interface CarreraItem extends CarreraData {
  id: string;
}

interface InscripcionItem {
  id: string;
  categoria: string;
  timestamp: any;
  competitor: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    email?: string;
    celular?: string;
    pais?: string;
    estado?: string;
    ciudad?: string;
    club?: string;
    fechaNacimiento?: string;
    edad?: number;
  };
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([]);
  const [selectedCarrera, setSelectedCarrera] = useState<string>('');
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([]);

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

  // 2) Cuando cambia la carrera, traigo inscripciones + datos del competidor
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([]);
      return;
    }
    (async () => {
      // Traer inscripciones de la colección raíz
      const insQ = query(
        collection(db, 'inscripciones'),
        where('carreraId', '==', selectedCarrera)
      );
      const insSnap = await getDocs(insQ);

      const items: InscripcionItem[] = await Promise.all(
        insSnap.docs.map(async d => {
          const data = d.data();
          const perfilId: string = data.perfilId;
          let compData: any = {};

          // 2.1 Intento leer del documento principal de usuario
          const mainRef = doc(db, 'usuarios', perfilId);
          const mainSnap = await getDoc(mainRef);
          if (mainSnap.exists()) {
            compData = mainSnap.data();
          } else {
            // 2.2 Si no existe, busco en cualquier subcolección 'perfiles'
            const perfilGroupQ = query(
              collectionGroup(db, 'perfiles'),
              where('__name__', '==', perfilId)
            );
            const perfilGroupSnap = await getDocs(perfilGroupQ);
            if (!perfilGroupSnap.empty) {
              compData = perfilGroupSnap.docs[0].data();
            }
          }

          return {
            id: d.id,
            categoria: data.categoria,
            timestamp: data.timestamp,
            competitor: {
              nombre: compData.nombre,
              apellidoPaterno: compData.apellidoPaterno,
              apellidoMaterno: compData.apellidoMaterno,
              email: compData.email,
              celular: compData.celular,
              pais: compData.pais,
              estado: compData.estado,
              ciudad: compData.ciudad,
              club: compData.club,
              fechaNacimiento: compData.fechaNacimiento,
              edad: compData.edad,
            },
          };
        })
      );

      setInscripciones(items);
    })();
  }, [selectedCarrera]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Ver Inscripciones</h2>

      <div className="mb-4">
        <label className="block font-medium mb-1">Selecciona Carrera:</label>
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

      {selectedCarrera && (
        inscripciones.length > 0 ? (
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Nombre</th>
                <th className="border p-2">Apellido P.</th>
                <th className="border p-2">Apellido M.</th>
                <th className="border p-2">Email</th>
                <th className="border p-2">Celular</th>
                <th className="border p-2">País</th>
                <th className="border p-2">Estado</th>
                <th className="border p-2">Ciudad</th>
                <th className="border p-2">Club</th>
                <th className="border p-2">Fecha Nac.</th>
                <th className="border p-2">Edad</th>
                <th className="border p-2">Categoría</th>
                <th className="border p-2">Fecha Inscripción</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="border p-2">{i.competitor.nombre}</td>
                  <td className="border p-2">{i.competitor.apellidoPaterno}</td>
                  <td className="border p-2">{i.competitor.apellidoMaterno}</td>
                  <td className="border p-2">{i.competitor.email || '-'}</td>
                  <td className="border p-2">{i.competitor.celular || '-'}</td>
                  <td className="border p-2">{i.competitor.pais || '-'}</td>
                  <td className="border p-2">{i.competitor.estado || '-'}</td>
                  <td className="border p-2">{i.competitor.ciudad || '-'}</td>
                  <td className="border p-2">{i.competitor.club || '-'}</td>
                  <td className="border p-2">
                    {i.competitor.fechaNacimiento || '-'}
                  </td>
                  <td className="border p-2">
                    {i.competitor.edad != null ? i.competitor.edad : '-'}
                  </td>
                  <td className="border p-2">{i.categoria}</td>
                  <td className="border p-2">
                    {i.timestamp?.toDate
                      ? i.timestamp.toDate().toLocaleString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-gray-500">
            No hay inscripciones para esta carrera.
          </p>
        )
      )}
    </div>
  );
}