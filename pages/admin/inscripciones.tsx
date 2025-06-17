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

  // 1) Cargo todas las carreras para el <select>
  useEffect(() => {
    getDocs(collection(db, 'carreras')).then(snap => {
      setCarreras(
        snap.docs.map(d => ({
          id: d.id,
          titulo: d.data().titulo,
        }))
      )
    })
  }, [])

  // 2) Cuando cambie la carrera seleccionada, traigo inscripciones de:
  //    • colección raíz /inscripciones
  //    • subcolección /carreras/{id}/inscripciones
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([])
      return
    }

    async function fetchInscripciones() {
      const lista: Inscripcion[] = []

      // a) de la colección raíz
      const raizQ = query(
        collection(db, 'inscripciones'),
        where('carreraId', '==', selectedCarrera)
      )
      const raizSnap = await getDocs(raizQ)
      raizSnap.docs.forEach(doc => {
        const d = doc.data()
        lista.push({
          id: doc.id,
          perfilId: d.perfilId,
          categoria: d.categoria,
          timestamp: d.timestamp,
        })
      })

      // b) de la subcolección dentro de carreras
      const nestedQ = query(
        collection(db, 'carreras', selectedCarrera, 'inscripciones'),
        where('carreraId', '==', selectedCarrera)
      )
      const nestedSnap = await getDocs(nestedQ)
      nestedSnap.docs.forEach(doc => {
        const d = doc.data()
        lista.push({
          id: doc.id,
          perfilId: d.perfilId,
          categoria: d.categoria,
          timestamp: d.timestamp,
        })
      })

      setInscripciones(lista)
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
            onChange={e => setSelectedCarrera(e.target.value)}
            className="w-full border p-2 rounded"
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
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Perfil ID</th>
                <th className="border p-2 text-left">Categoría</th>
                <th className="border p-2 text-left">Fecha Inscripción</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.length > 0 ? (
                inscripciones.map(insc => (
                  <tr key={insc.id} className="hover:bg-gray-50">
                    <td className="border p-2">{insc.perfilId}</td>
                    <td className="border p-2">{insc.categoria}</td>
                    <td className="border p-2">
                      {insc.timestamp?.toDate
                        ? insc.timestamp.toDate().toLocaleString()
                        : ''}
                    </td>
                  </tr>
                ))
              ) : (
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