import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CarreraData } from '@/types/carrera'

interface CarreraItem extends CarreraData {
  id: string
}

interface InscripcionItem {
  id: string
  perfilId: string
  categoria: string
  timestamp: any
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([])
  const [selectedCarrera, setSelectedCarrera] = useState<string>('')
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([])

  // 1) Cargo todas las carreras
  useEffect(() => {
    ;(async () => {
      const snap = await getDocs(collection(db, 'carreras'))
      setCarreras(
        snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as CarreraData),
        }))
      )
    })()
  }, [])

  // 2) Cuando cambie la carrera seleccionada, traigo desde la colección raíz
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([])
      return
    }
    ;(async () => {
      const q = query(
        collection(db, 'inscripciones'),
        where('carreraId', '==', selectedCarrera)
      )
      const snap = await getDocs(q)
      setInscripciones(
        snap.docs.map(d => {
          const data = d.data()
          return {
            id: d.id,
            perfilId: data.perfilId,
            categoria: data.categoria,
            timestamp: data.timestamp,
          }
        })
      )
    })()
  }, [selectedCarrera])

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
      {selectedCarrera && (
        inscripciones.length > 0 ? (
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Perfil ID</th>
                <th className="border p-2">Categoría</th>
                <th className="border p-2">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="border p-2">{i.perfilId}</td>
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
  )
}