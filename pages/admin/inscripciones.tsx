import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { db } from '@/lib/firebase'
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where
} from 'firebase/firestore'

interface Carrera {
  id: string
  titulo: string
}

interface Inscripcion {
  id: string
  perfilId: string
  categoria: string
  timestamp: any
}

export default function AdminInscripcionesPage() {
  const [carreras, setCarreras] = useState<Carrera[]>([])
  const [selectedCarrera, setSelectedCarrera] = useState<string>('')
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])

  // 1) Cargar todas las carreras para el select
  useEffect(() => {
    const fetchCarreras = async () => {
      const snap = await getDocs(collection(db, 'carreras'))
      setCarreras(
        snap.docs.map((d) => ({
          id: d.id,
          titulo: d.data().titulo,
        }))
      )
    }
    fetchCarreras()
  }, [])

  // 2) Cada vez que cambie la carrera seleccionada, cargo sus inscripciones
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([])
      return
    }
    const fetchInscripciones = async () => {
      // collectionGroup va a buscar en cualquier colección llamada "inscripciones"
      // tanto en la raíz como en subcolecciones de carreras
      const inscQ = query(
        collectionGroup(db, 'inscripciones'),
        where('carreraId', '==', selectedCarrera)
      )
      const snap = await getDocs(inscQ)
      setInscripciones(
        snap.docs.map((doc) => {
          const d = doc.data()
          return {
            id: doc.id,
            perfilId: d.perfilId,
            categoria: d.categoria,
            timestamp: d.timestamp,
          }
        })
      )
    }
    fetchInscripciones()
  }, [selectedCarrera])

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Ver Inscripciones</h1>

        <div className="mb-4">
          <label className="block font-medium mb-1">Selecciona Carrera</label>
          <select
            value={selectedCarrera}
            onChange={(e) => setSelectedCarrera(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="">-- Elige una carrera --</option>
            {carreras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </div>

        {selectedCarrera && (
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Perfil ID</th>
                <th className="border p-2 text-left">Categoría</th>
                <th className="border p-2 text-left">Fecha Inscripción</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((insc) => (
                <tr key={insc.id} className="hover:bg-gray-50">
                  <td className="border p-2">{insc.perfilId}</td>
                  <td className="border p-2">{insc.categoria}</td>
                  <td className="border p-2">
                    {insc.timestamp?.toDate
                      ? insc.timestamp.toDate().toLocaleString()
                      : ''}
                  </td>
                </tr>
              ))}

              {inscripciones.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center p-4 text-gray-500">
                    No hay inscripciones para esta carrera.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </ProtectedRoute>
  )
}