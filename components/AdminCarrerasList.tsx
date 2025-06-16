import { useEffect, useState } from 'react'
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AdminCarrerasForm from './AdminCarrerasForm'
import type { CarreraData, Categoria } from '@/types/carrera'

interface CarreraDoc extends CarreraData {
  id: string
}

export default function AdminCarrerasList({
  onEdit,
}: {
  onEdit: (c: CarreraDoc) => void
}) {
  const [carreras, setCarreras] = useState<CarreraDoc[]>([])

  const loadCarreras = async () => {
    const snap = await getDocs(collection(db, 'carreras'))
    const list = snap.docs.map((d) => {
      const data = d.data() as Partial<CarreraData>
      return {
        id: d.id,
        // rellenamos con valores por defecto si faltan
        titulo: data.titulo || '',
        descripcion: data.descripcion || '',
        ubicacion: data.ubicacion || '',
        fecha: data.fecha || '',
        hora: data.hora || '',
        categorias: data.categorias || [],
        imagenBase64: data.imagenBase64,
        nombreArchivo: data.nombreArchivo,
      }
    })
    setCarreras(list)
  }

  useEffect(() => {
    loadCarreras()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta carrera?')) return
    await deleteDoc(doc(db, 'carreras', id))
    loadCarreras()
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Carreras Activas</h2>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border p-2">Título</th>
            <th className="border p-2">Fecha / Hora</th>
            <th className="border p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {carreras.map((c) => (
            <tr key={c.id}>
              <td className="border p-2">{c.titulo}</td>
              <td className="border p-2">
                {new Date(`${c.fecha}T${c.hora}`).toLocaleString()}
              </td>
              <td className="border p-2 space-x-2">
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => onEdit(c)}
                >
                  Editar
                </button>
                <button
                  className="text-red-600 hover:underline"
                  onClick={() => handleDelete(c.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}