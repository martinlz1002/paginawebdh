import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import { doc, collection, onSnapshot } from "firebase/firestore"
import { db } from "../../../lib/firebase"

type Equipo = {
  id: string
  nombre: string
  vueltas: number
  metrosExtra?: number
  ultimaVuelta?: number
}

type Evento = {
  nombreEvento?: string
  longitudPista: number
}

export default function VueltasTV() {

  const router = useRouter()
  const { id } = router.query

  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [evento, setEvento] = useState<Evento | null>(null)

  useEffect(() => {

    if (!id) return

    const eventoRef = doc(db, "eventos_vueltas", id as string)

    const unsubEvento = onSnapshot(eventoRef, snap => {
      if (snap.exists()) setEvento(snap.data() as Evento)
    })

    const equiposRef = collection(db, "eventos_vueltas", id as string, "equipos")

    const unsubEquipos = onSnapshot(equiposRef, snap => {

      const lista = snap.docs.map(doc => ({
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

  const pista = evento?.longitudPista || 400

  const ranking = useMemo(() => {

    return [...equipos].sort((a, b) => {

      const distA = a.vueltas * pista + (a.metrosExtra || 0)
      const distB = b.vueltas * pista + (b.metrosExtra || 0)

      return distB - distA
    })

  }, [equipos, pista])

  function formatTime(ms?: number) {

    if (!ms) return "-"

    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  function calcularTiempoTotal(e: Equipo) {

    if (!e.ultimaVuelta) return 0
    return e.ultimaVuelta * e.vueltas
  }

  const lider = ranking[0]

  return (

    <div style={{
      background: "#000",
      color: "#fff",
      minHeight: "100vh",
      padding: "40px",
      fontFamily: "sans-serif"
    }}>

      <h1 style={{
        textAlign: "center",
        fontSize: "48px",
        marginBottom: "40px"
      }}>
        {evento?.nombreEvento || "Carrera"}
      </h1>

      <table style={{
        width: "100%",
        fontSize: "28px",
        borderCollapse: "collapse"
      }}>

        <thead>
          <tr style={{ borderBottom: "3px solid white" }}>
            <th>POS</th>
            <th style={{ textAlign: "left" }}>EQUIPO</th>
            <th>VUELTAS</th>
            <th>ÚLTIMA</th>
            <th>GAP</th>
            <th>DISTANCIA</th>
          </tr>
        </thead>

        <tbody>

          {ranking.map((e, index) => {

            const distancia = e.vueltas * pista + (e.metrosExtra || 0)

            let gap = "---"

            if (index !== 0 && lider) {

              const diffVueltas = lider.vueltas - e.vueltas

              if (diffVueltas > 0) {

                gap = `-${diffVueltas} vuelta${diffVueltas > 1 ? "s" : ""}`

              } else {

                const tiempoLider = calcularTiempoTotal(lider)
                const tiempoEquipo = calcularTiempoTotal(e)

                const diff = tiempoEquipo - tiempoLider

                gap = `+${formatTime(diff)}`
              }
            }

            return (

              <tr key={e.id} style={{
                borderBottom: "1px solid #444",
                transition: "all 0.4s ease"
              }}>

                <td style={{ textAlign: "center" }}>
                  {index + 1}
                </td>

                <td>
                  {e.nombre}
                </td>

                <td style={{ textAlign: "center" }}>
                  {e.vueltas}
                </td>

                <td style={{ textAlign: "center" }}>
                  {formatTime(e.ultimaVuelta)}
                </td>

                <td style={{ textAlign: "center" }}>
                  {gap}
                </td>

                <td style={{ textAlign: "center" }}>
                  {distancia} m
                </td>

              </tr>
            )
          })}

        </tbody>

      </table>

    </div>
  )
}