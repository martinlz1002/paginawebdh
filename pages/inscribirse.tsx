import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import { app, db } from '@/lib/firebase'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { loadStripe } from '@stripe/stripe-js'

import {
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ClipboardIcon,
} from '@heroicons/react/24/outline'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

interface Categoria { nombre: string; minAge: number; maxAge: number }
interface Carrera {
  id: string
  titulo: string
  descripcion?: string
  lugar?: string
  fecha?: string
  horaSalida?: string
  bannerUrl?: string
  precio: number
  categorias: Categoria[]
}
interface Perfil {
  id: string
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  edad: number
}

export default function InscribirsePage() {
  const router = useRouter()
  const { carreraId } = router.query
  const [carrera, setCarrera] = useState<Carrera | null>(null)
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [perfilId, setPerfilId] = useState('')
  const [categoria, setCategoria] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loadingPerfiles, setLoadingPerfiles] = useState(true)
  const auth = getAuth(app)

  // carga carrera
  useEffect(() => {
    if (!carreraId) return
    getDoc(doc(db, 'carreras', carreraId as string)).then(snap => {
      if (!snap.exists()) return setMensaje('Carrera no encontrada')
      const d = snap.data() as any
      setCarrera({
        id: snap.id,
        titulo: d.titulo,
        descripcion: d.descripcion,
        lugar: d.lugar || d.ubicacion,
        fecha: d.fecha instanceof Timestamp
          ? d.fecha.toDate().toLocaleDateString()
          : d.fecha,
        horaSalida: d.horaSalida,
        bannerUrl: d.bannerUrl,
        precio: d.precio,
        categorias: d.categorias || [],
      })
    })
  }, [carreraId])

  // auth + perfiles
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) return router.replace('/login')
      ;(async () => {
        // perfil principal
        const main = await getDoc(doc(db, 'usuarios', user.uid))
        const lista: Perfil[] = []
        if (main.exists()) {
          const d: any = main.data()
          lista.push({
            id: user.uid,
            nombre: d.nombre,
            apellidoPaterno: d.apPaterno,
            apellidoMaterno: d.apMaterno,
            edad: d.edad,
          })
        }
        // subperfiles
        const snap = await getDocs(
          collection(db, 'usuarios', user.uid, 'perfiles')
        )
        snap.forEach(d => {
          const p: any = d.data()
          lista.push({
            id: d.id,
            nombre: p.nombre,
            apellidoPaterno: p.apellidoPaterno,
            apellidoMaterno: p.apellidoMaterno,
            edad: p.edad,
          })
        })
        setPerfiles(lista)
        if (lista[0]) setPerfilId(lista[0].id)
        setLoadingPerfiles(false)
      })()
    })
    return () => unsub()
  }, [])

  // al hacer click en "Inscribirme" → pago
  const handlePago = async () => {
    setMensaje('')
    if (!perfilId || !categoria) {
      return setMensaje('Selecciona perfil y categoría')
    }
    if (!carrera) return

    try {
      const resp = await fetch('/api/checkout_sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carreraId: carrera.id,
          perfilId,
          categoria,
          precio: carrera.precio,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => null)
        throw new Error(err?.error || `HTTP ${resp.status}`)
      }
      const { sessionId } = await resp.json()

      const stripe = await stripePromise
      await stripe!.redirectToCheckout({ sessionId })
    } catch (err: any) {
      console.error('Error al iniciar pago:', err)
      setMensaje(`Error al iniciar pago: ${err.message}`)
    }
  }

  if (!carrera) {
    return (
      <AuthGuard>
        <p className="text-center mt-10">{mensaje || 'Cargando…'}</p>
      </AuthGuard>
    )
  }

  // filtrar categorías por edad
  const perfilActual = perfiles.find(p => p.id === perfilId)
  const catsPermitidas = carrera.categorias.filter(cat =>
    perfilActual
      ? perfilActual.edad >= cat.minAge && perfilActual.edad <= cat.maxAge
      : false
  )

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {carrera.bannerUrl && (
          <div
            className="h-56 bg-cover bg-center"
            style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
          />
        )}
        <div className="p-6 space-y-6">
          <h1 className="text-3xl font-bold">{carrera.titulo}</h1>
          {carrera.descripcion && (
            <p className="text-gray-700">{carrera.descripcion}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-gray-600">
            {carrera.lugar && (
              <div className="flex items-center space-x-2">
                <MapPinIcon className="w-5 h-5 text-gray-500" />
                <span>{carrera.lugar}</span>
              </div>
            )}
            {carrera.fecha && (
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
                <span>{carrera.fecha}</span>
              </div>
            )}
            {carrera.horaSalida && (
              <div className="flex items-center space-x-2">
                <ClockIcon className="w-5 h-5 text-purple-600" />
                <span>{carrera.horaSalida}</span>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2">
              <ClipboardIcon className="w-6 h-6 text-green-700" />
              <span>Categorías / Precio: ${carrera.precio.toFixed(2)}</span>
            </h2>
            <table className="w-full table-auto border-collapse text-gray-700">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2">Nombre</th>
                  <th className="border px-4 py-2">Edad mínima</th>
                  <th className="border px-4 py-2">Edad máxima</th>
                </tr>
              </thead>
              <tbody>
                {carrera.categorias.map(cat => (
                  <tr key={cat.nombre} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">{cat.nombre}</td>
                    <td className="border px-4 py-2">{cat.minAge}</td>
                    <td className="border px-4 py-2">{cat.maxAge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-6 border-t space-y-4">
            {/* Perfil */}
            <div>
              <label className="block font-medium mb-1 flex items-center space-x-1">
                <UserIcon className="w-5 h-5 text-green-600" />
                <span>Tu perfil</span>
              </label>
              {loadingPerfiles ? (
                <p>Cargando perfiles…</p>
              ) : (
                <select
                  className="w-full border p-2 rounded"
                  value={perfilId}
                  onChange={e => setPerfilId(e.target.value)}
                >
                  {perfiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.apellidoPaterno} ({p.edad} años)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Categoría */}
            <div>
              <label className="block font-medium mb-1 flex items-center space-x-1">
                <ClipboardIcon className="w-5 h-5 text-purple-700" />
                <span>Categoría</span>
              </label>
              <select
                className="w-full border p-2 rounded disabled:opacity-50"
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                disabled={!catsPermitidas.length}
              >
                <option value="">-- Selecciona categoría --</option>
                {catsPermitidas.map(cat => (
                  <option key={cat.nombre} value={cat.nombre}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón */}
            <button
              onClick={handlePago}
              disabled={!perfilId || !categoria}
              className={`w-full flex justify-center items-center py-3 rounded text-white transition ${
                perfilId && categoria
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Inscribirme y pagar
            </button>

            {mensaje && (
              <p className="text-center text-red-600">{mensaje}</p>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}