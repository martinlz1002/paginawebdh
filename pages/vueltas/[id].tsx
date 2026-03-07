import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { doc, collection, onSnapshot } from "firebase/firestore"
import { db } from "../../lib/firebase"

type Equipo = {
  id: string
  nombre: string
  vueltas: number
  metrosExtra?: number
  ultimaVuelta?: number
}

type Evento = {
  longitudPista: number
  horaInicio?: number
}

export default function VueltasEvento() {

  const router = useRouter()
  const { id } = router.query

  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [evento, setEvento] = useState<Evento | null>(null)

  useEffect(() => {

    if (!id) return

    const eventoRef = doc(db, "eventos_vueltas", id as string)

    const unsubEvento = onSnapshot(eventoRef, (docSnap) => {

      if (docSnap.exists()) {
        setEvento(docSnap.data() as Evento)
      }

    })

    const equiposRef = collection(db, "eventos_vueltas", id as string, "equipos")

    const unsubEquipos = onSnapshot(equiposRef, (snapshot) => {

      const lista = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Equipo[]

      setEquipos(lista)

    })

    return () => {
      unsubEvento()
      unsubEquipos()
    }

  }, [id])

  function formatTime(ms?: number) {

    if (!ms) return "-"

    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const pista = evento?.longitudPista || 400

  const equiposOrdenados = [...equipos].sort((a, b) => {

    const distA = a.vueltas * pista + (a.metrosExtra || 0)
    const distB = b.vueltas * pista + (b.metrosExtra || 0)

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
            <th>Última vuelta</th>
            <th>Distancia</th>
          </tr>
        </thead>

        <tbody>

          {equiposOrdenados.map((e, index) => {

            const distancia = e.vueltas * pista + (e.metrosExtra || 0)

            return (
              <tr key={e.id}>
                <td>{index + 1}</td>
                <td>{e.nombre}</td>
                <td>{e.vueltas}</td>
                <td>{formatTime(e.ultimaVuelta)}</td>
                <td>{distancia} m</td>
              </tr>
            )
          })}

        </tbody>

      </table>

    </div>
  )
}