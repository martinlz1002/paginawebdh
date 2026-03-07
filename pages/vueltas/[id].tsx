import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "../../lib/firebase"

type Equipo = {
  id: string
  nombre: string
  vueltas: number
  metrosExtra?: number
}

export default function VueltasEvento() {

  const router = useRouter()
  const { id } = router.query

  const [equipos, setEquipos] = useState<Equipo[]>([])

  useEffect(() => {

    if (!id) return

    const ref = collection(db, "eventos_vueltas", id as string, "equipos")

    const unsubscribe = onSnapshot(ref, (snapshot) => {

      const lista = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Equipo[]

      setEquipos(lista)

    })

    return () => unsubscribe()

  }, [id])

  const equiposOrdenados = [...equipos].sort((a, b) => {

    const distA = a.vueltas * 400 + (a.metrosExtra || 0)
    const distB = b.vueltas * 400 + (b.metrosExtra || 0)

    return distB - distA
  })

  return (
    <div style={{ padding: 40 }}>

      <h1>Resultados en vivo</h1>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>Vueltas</th>
            <th>Extra (m)</th>
            <th>Distancia total</th>
          </tr>
        </thead>

        <tbody>

          {equiposOrdenados.map((e, index) => {

            const total = e.vueltas * 400 + (e.metrosExtra || 0)

            return (
              <tr key={e.id}>
                <td>{index + 1}</td>
                <td>{e.nombre}</td>
                <td>{e.vueltas}</td>
                <td>{e.metrosExtra || 0}</td>
                <td>{total} m</td>
              </tr>
            )
          })}

        </tbody>
      </table>

    </div>
  )
}