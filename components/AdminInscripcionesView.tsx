import React, { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  collectionGroup,
  documentId
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CarreraData } from '@/types/carrera'

interface CarreraItem extends CarreraData {
  id: string
}

interface PerfilData {
  nombre: string
  apPaterno: string
  apMaterno: string
  email?: string
  celular?: string
  pais?: string
  estado?: string
  ciudad?: string
  club?: string
  fechaNacimiento?: string
  edad?: number
}

interface InscripcionItem {
  id: string
  perfilId: string        // ID del subperfil o del perfil principal
  perfilOwner: string     // UID del dueño (igual a perfilId si es perfil principal)
  categoria: string
  timestamp: any
  perfil: PerfilData | null
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<CarreraItem[]>([])
  const [selectedCarrera, setSelectedCarrera] = useState<string>('')
  const [inscripciones, setInscripciones] = useState<InscripcionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // 2) Cuando cambia la carrera, traigo inscripciones + perfil completo
  useEffect(() => {
    if (!selectedCarrera) {
      setInscripciones([])
      return
    }
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        // 2.1) obtengo inscripciones de raíz
        const q = query(
          collection(db, 'inscripciones'),
          where('carreraId', '==', selectedCarrera)
        )
        const snap = await getDocs(q)

        const items: InscripcionItem[] = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data()!
            let perfil: PerfilData | null = null

            // 2a) intento perfil principal
            const mainRef = doc(db, 'usuarios', data.perfilOwner)
            const mainSnap = await getDoc(mainRef)
            if (mainSnap.exists()) {
              perfil = mainSnap.data() as PerfilData
            } else {
              // 2b) si no existe como documento raíz, lo busco en la subcolección
              const subRef = doc(
                db,
                'usuarios',
                data.perfilOwner,
                'perfiles',
                data.perfilId
              )
              const subSnap = await getDoc(subRef)
              if (subSnap.exists()) {
                perfil = subSnap.data() as PerfilData
              }
            }

            return {
              id: d.id,
              perfilId: data.perfilId,
              perfilOwner: data.perfilOwner,
              categoria: data.categoria,
              timestamp: data.timestamp,
              perfil,
            }
          })
        )

        setInscripciones(items)
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Error al cargar inscripciones')
      } finally {
        setLoading(false)
      }
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

      {loading && <p>Cargando inscripciones…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {selectedCarrera && !loading && !error && (
        inscripciones.length > 0 ? (
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Nombre Completo</th>
                <th className="border p-2">Email</th>
                <th className="border p-2">Celular</th>
                <th className="border p-2">País / Estado / Ciudad</th>
                <th className="border p-2">Club</th>
                <th className="border p-2">Edad</th>
                <th className="border p-2">Categoría</th>
                <th className="border p-2">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map(i => {
                const p = i.perfil
                const nombreCompleto = p
                  ? `${p.nombre} ${p.apPaterno} ${p.apMaterno}`
                  : '(Datos no encontrados)'
                return (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="border p-2">{nombreCompleto}</td>
                    <td className="border p-2">{p?.email || '-'}</td>
                    <td className="border p-2">{p?.celular || '-'}</td>
                    <td className="border p-2">
                      {p
                        ? `${p.pais || '-'} / ${p.estado || '-'} / ${p.ciudad || '-'}`
                        : '-'}
                    </td>
                    <td className="border p-2">{p?.club || '-'}</td>
                    <td className="border p-2">{p?.edad ?? '-'}</td>
                    <td className="border p-2">{i.categoria}</td>
                    <td className="border p-2">
                      {i.timestamp?.toDate
                        ? i.timestamp.toDate().toLocaleString()
                        : '-'}
                    </td>
                  </tr>
                )
              })}
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