import { useRouter } from "next/router"
import { useRef } from "react"
import { useEffect, useMemo, useState } from "react"
import { doc, collection, onSnapshot, query, orderBy, limit } from "firebase/firestore"
import { db } from "../../../lib/firebase"
import { where } from "firebase/firestore"
import {
  getDatabase,
  ref,
  onValue
} from "firebase/database"

type Equipo = {
  id: string
  nombre: string
  vueltas: number
  metrosExtra?: number
  ultimoTiempoVuelta?: number
  ultimaVuelta?: number
  categoria?: string
  amonestado?: boolean
  penalizarRojoEquipo?: boolean

  penalizaciones?: {
  metros: number
  motivo?: string
}[]
}

type Evento = {
  nombreEvento?: string
  longitudPista: number

  horaInicio?: number
  duracion?: number 
  pausado?: boolean
}

type FotoEvento = {
  id: string

  url?: string
  foto?: string

  equipoNombre?: string

  vuelta?: number

  timestamp?: number
}

export default function VueltasTV() {

  const router = useRouter()
  const { id } = router.query

  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [evento, setEvento] = useState<Evento | null>(null)

  const [fotoActual, setFotoActual] = useState<FotoEvento | null>(null)
  const [colaFotos, setColaFotos] = useState<FotoEvento[]>([])
  const [mostrando, setMostrando] = useState(false)

  const prevRankingRef = useRef<Equipo[]>([])

  const posicionesRef = useRef<Record<string, number>>({})

  const animadasRef = useRef<Record<string, number>>({})

  const primerCargaRef = useRef(true)

  const [mejorVueltaEvento, setMejorVueltaEvento] = useState<{
  equipo: string
  tiempo: number
} | null>(null)

const [highlight, setHighlight] = useState<string | null>(null)

const [mostrarEstadisticas,
setMostrarEstadisticas] = useState(true)

const [realtimeData,
setRealtimeData] = useState<any>(null)

const [tabCategoria, setTabCategoria] = useState<
  "general" | "varonil" | "femenil" | "mixto"
>("general")

const [sponsorIndex, setSponsorIndex] = useState(0)

const [animandoTab, setAnimandoTab] = useState(false)

const tabs = useMemo(() => {

  const disponibles = ["general"]

  if (
  equipos.some(
    e =>
      e.categoria?.toLowerCase() === "varonil"
  )
) {
    disponibles.push("varonil")
  }

  if (
  equipos.some(
    e =>
      e.categoria?.toLowerCase() === "femenil"
  )
) {
    disponibles.push("femenil")
  }

  if (
  equipos.some(
    e =>
      e.categoria?.toLowerCase() === "mixto"
  )
) {
    disponibles.push("mixto")
  }

  return disponibles as (
    "general" |
    "varonil" |
    "femenil" |
    "mixto"
  )[]

}, [equipos])

const [tiempoRestante, setTiempoRestante] = useState<number>(0)

const [isPortrait, setIsPortrait] =
  useState(false)

useEffect(() => {

  if (!id) return

  const realtimeDb = getDatabase()

  const relojRef = ref(
    realtimeDb,
    `cronometro/${id}`
  )

  const unsubscribe = onValue(
    relojRef,
    snap => {

      const data = snap.val()

      if (!data) return

      setRealtimeData(data)

    }
  )

  return () => unsubscribe()

}, [id])

useEffect(() => {

  if (!realtimeData) return

  const interval = setInterval(() => {

    if (realtimeData.paused) return

    const ahora = Date.now()

    const transcurrido =
      ahora - realtimeData.startedAt

    const restante =
      realtimeData.duracion - transcurrido

    if (restante <= 0) {

      setTiempoRestante(0)

      setHighlight(
        "🏁 Tiempo terminado"
      )

      return
    }

    setTiempoRestante(
      restante
    )

  }, 1000)

  return () => clearInterval(interval)

}, [realtimeData])

const formatTiempoRestante = (ms: number) => {

  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

useEffect(() => {

  equipos.forEach(e => {

    if (!e.ultimoTiempoVuelta) return

    if (
      !mejorVueltaEvento ||
      e.ultimoTiempoVuelta < mejorVueltaEvento.tiempo
    ) {

      setMejorVueltaEvento({
        equipo: e.nombre,
        tiempo: e.ultimoTiempoVuelta
      })

      // 🎬 activar highlight
      setHighlight(`🔥 Mejor vuelta: ${e.nombre}`)
      
      setTimeout(() => setHighlight(null), 4000)
    }

  })

  

}, [equipos])

const mejorUltimaVuelta = useMemo(() => {

  return equipos.reduce((best, e) => {

    if (!e.ultimoTiempoVuelta) return best
    if (!best || e.ultimoTiempoVuelta < best.ultimoTiempoVuelta!) return e

    return best

  }, null as Equipo | null)

}, [equipos])

const [inicioTV, setInicioTV] = useState<number | null>(null)

useEffect(() => {
  setInicioTV(Date.now())
}, [])

useEffect(() => {

  const checkOrientation = () => {

    const mobile =
      window.innerWidth < 900

    const portrait =
      window.innerHeight >
      window.innerWidth

    setIsPortrait(
      mobile && portrait
    )

  }

  checkOrientation()

  window.addEventListener(
    "resize",
    checkOrientation
  )

  return () =>
    window.removeEventListener(
      "resize",
      checkOrientation
    )

}, [])

useEffect(() => {

  const interval = setInterval(() => {

    setAnimandoTab(true)

    setTimeout(() => {

      setTabCategoria(prev => {

        const currentIndex = tabs.indexOf(prev)

        const nextIndex =
          (currentIndex + 1) % tabs.length

        return tabs[nextIndex]

      })

      setTimeout(() => {
        setAnimandoTab(false)
      }, 80)

    }, 350)

  }, 15000)

  return () => clearInterval(interval)

}, [tabs])


useEffect(() => {

  prevRankingRef.current = ranking

  posicionesRef.current = {}

  animadasRef.current = {}

}, [tabCategoria])




// 🔹 EVENTO + EQUIPOS (igual)
useEffect(() => {

  if (!id) return

  const eventoRef = doc(db, "eventos_vueltas", id as string)

  const unsubEvento = onSnapshot(eventoRef, snap => {

  if (!snap.exists()) return

  const data = snap.data()

  setEvento(data as Evento)

  // 🔥 MOSTRAR / OCULTAR ESTADÍSTICAS
  setMostrarEstadisticas(
    data.mostrarEstadisticas !== false
  )

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


// 🔥 ESCUCHAR SOLO FOTOS NUEVAS
useEffect(() => {

  if (!id || !inicioTV) return

  const fotosRef = query(
    collection(db, "eventos_vueltas", id as string, "fotos_evento"),
    where("timestamp", ">", inicioTV),
    orderBy("timestamp", "asc")
  )

  const unsub = onSnapshot(fotosRef, snapshot => {

    snapshot.docChanges().forEach(change => {

      if (change.type === "added") {

        const data = change.doc.data() as Omit<FotoEvento, "id">

        // 🔥 FILTRO REAL
        if (!data.timestamp || data.timestamp <= inicioTV) return

        const nuevaFoto: FotoEvento = {
          id: change.doc.id,
          ...data
        }

        setColaFotos(prev => [...prev, nuevaFoto])
      }

    })

  })

  return () => unsub()

}, [id, inicioTV])


// 🎬 COLA DE FOTOS (simplificada)
useEffect(() => {

  if (mostrando) return
  if (colaFotos.length === 0) return

  const siguiente = colaFotos[0]

  setFotoActual(siguiente)
  setMostrando(true)

  setTimeout(() => {

    setFotoActual(null)
    setColaFotos(prev => prev.slice(1))
    setMostrando(false)

  }, 5000)

}, [colaFotos, mostrando])


  const pista = evento?.longitudPista || 400

  const calcularDistancia = (e: Equipo) => {

  const penalizacion =
    e.penalizaciones?.reduce(
      (acc, p) => acc + p.metros,
      0
    ) || 0

  const total =
    (e.vueltas * pista)
    + (e.metrosExtra || 0)
    - penalizacion

  return Math.max(total, 0)
}

const tienePenalizacion = (e: Equipo) => {

  return (
    (e.penalizaciones?.length || 0) > 0
  )
}

const totalPenalizacion = (e: Equipo) => {

  return e.penalizaciones?.reduce(
    (acc, p) => acc + p.metros,
    0
  ) || 0
}

  const equiposFiltrados = useMemo(() => {

  if (tabCategoria === "general") {
    return equipos
  }

  return equipos.filter(

  e =>

    e.categoria?.toLowerCase()
      === tabCategoria

)

}, [equipos, tabCategoria])

  const ranking = useMemo(() => {

  return [...equiposFiltrados].sort((a, b) => {

    const distA = calcularDistancia(a)
    const distB = calcularDistancia(b)

    // 🥇 1. ordenar por distancia
    if (distB !== distA) {
      return distB - distA
    }

    // 🥈 2. desempate por quién llegó primero
    const tiempoA = a.ultimaVuelta || 0
    const tiempoB = b.ultimaVuelta || 0

    return tiempoA - tiempoB

  })

}, [equiposFiltrados, pista])



  function formatTime(ms?: number) {

    if (!ms) return "-"

    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const lider = ranking[0]

  const movimientos = useMemo(() => {

  const prev = prevRankingRef.current
  const cambios: Record<string, "up" | "down" | "same"> = {}

  ranking.forEach((equipo, index) => {

    const prevIndex = prev.findIndex(e => e.id === equipo.id)

    if (prevIndex === -1) {
      cambios[equipo.id] = "same"
      return
    }

    if (index < prevIndex) {
      cambios[equipo.id] = "up"
    } else if (index > prevIndex) {
      cambios[equipo.id] = "down"
    } else {
      cambios[equipo.id] = "same"
    }

  })

  return cambios

}, [ranking])

useEffect(() => {

  // 🔥 guardar posiciones ANTES de actualizar
  const prev = prevRankingRef.current

  const prevPositions: Record<string, number> = {}

  prev.forEach((e, index) => {
    prevPositions[e.id] = index
  })

  posicionesRef.current = prevPositions

  // luego actualizar ranking anterior
  prevRankingRef.current = ranking

}, [ranking])

const obtenerTransform = (id: string, index: number) => {

  const prevIndex = posicionesRef.current[id]

  if (prevIndex === undefined) return undefined

  const delta = (prevIndex - index) * 60

  if (delta === 0) return undefined

  return `translateY(${delta}px)`
}


const cardStyle = {
  flex: 1,
  background: "#111",
  padding: "15px",
  borderRadius: "10px",
  textAlign: "center" as const,
  boxShadow: "0 0 15px rgba(255,255,255,0.08)"
}

const sponsors = [

  {
    src:"/Caffenio_blanco.png",
    height:"200px"
  },

  {
    src:"/mizuno.png",
    height:"80px"
  },

  {
    src:"/nissan.png",
    height:"85px"
  },

  {
    src:"/Calzzasport_Logo_White.png",
    height:"95px"
  },
  {
    src:"/zarigueyas_white.png",
    height:"150px"
  }

]



useEffect(() => {

  const interval = setInterval(() => {

    setSponsorIndex(prev =>
      (prev + 1) % sponsors.length
    )

  }, 4000)

  return () => clearInterval(interval)

}, [])

if (isPortrait) {

  return (

    <div style={{
      width:"100vw",
      height:"100vh",
      background:"#050505",
      color:"#fff",

      display:"flex",
      flexDirection:"column",

      justifyContent:"center",
      alignItems:"center",

      textAlign:"center",

      padding:"30px",

      fontFamily:"system-ui"
    }}>

      <div style={{
        fontSize:"90px",
        marginBottom:"25px",
        animation:"rotatePhone 2s ease-in-out infinite"
      }}>
        📱
      </div>

      <h1 style={{
        fontSize:"34px",
        marginBottom:"15px",
        fontWeight:"bold"
      }}>
        Gira tu dispositivo
      </h1>

      <p style={{
        fontSize:"20px",
        opacity:0.75,
        maxWidth:"420px",
        lineHeight:"1.5"
      }}>
        La tabla de cronometraje
        se aprecia mucho mejor
        en horizontal
      </p>

    </div>

  )

}

return (
<>
  {highlight && (
    <div style={{
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#ff9800",
      color: "#000",
      padding: "12px 25px",
      borderRadius: "8px",
      fontSize: "20px",
      fontWeight: "bold",
      zIndex: 999
    }}>
      {highlight}
    </div>
  )}

  <div style={{
    background:"linear-gradient(180deg,#050505,#111)",
    color:"#fff",
    minHeight:"100vh",
    padding:"30px",
    fontFamily:"system-ui",
    position:"relative"
  }}>

    <h1 style={{
      textAlign:"center",
      fontSize:"30px",
      marginBottom:"30px"
    }}>
      {evento?.nombreEvento || "Carrera"}
    </h1>

    <div style={{
  display:"flex",
  justifyContent:"space-between",
  alignItems:"center",
  marginBottom:"25px",
  width:"100%"
}}>

  {/* SPONSOR IZQUIERDA */}
  <div style={{
    width:"220px",
    display:"flex",
    justifyContent:"center",
    alignItems:"center",
    height:"60px"
  }}>

    <img
      key={sponsors[sponsorIndex].src}
      src={sponsors[sponsorIndex].src}
      style={{
        height:sponsors[sponsorIndex].height,
        width:"auto",
        objectFit:"contain",
        opacity:0.9,
        transition:"0.4s",
        animation:"fadeSponsor 0.5s ease",
        filter:"drop-shadow(0 0 8px rgba(0,0,0,0.7))"
      }}
    />

  </div>

  {/* TABS */}
  <div style={{
    display:"flex",
    justifyContent:"center",
    gap:"12px",
    flex:1
  }}>

    {[
      "general",
      "varonil",
      "femenil",
    ].map(tab => (

      <button
        key={tab}

        onClick={() =>
          setTabCategoria(tab as any)
        }

        style={{

          background:
            tabCategoria === tab
              ? "#4CAF50"
              : "#222",

          color:"#fff",

          border:"none",

          padding:"12px 22px",

          borderRadius:"10px",

          fontSize:"18px",

          fontWeight:"bold",

          cursor:"pointer",

          transition:"0.25s"
        }}
      >

        {tab.toUpperCase()}

      </button>

    ))}

  </div>

  {/* SPONSOR DERECHA */}
  <div style={{
    width:"220px",
    display:"flex",
    justifyContent:"center",
    alignItems:"center",
    height:"60px"
  }}>

    <img
      key={sponsors[sponsorIndex].src}
      src={sponsors[sponsorIndex].src}
      style={{
        height:sponsors[sponsorIndex].height,
        width:"auto",
        objectFit:"contain",
        opacity:0.9,
        transition:"0.4s",
        animation:"fadeSponsor 0.5s ease",
        filter:"drop-shadow(0 0 8px rgba(0,0,0,0.7))"
      }}
    />

  </div>

</div>

{mostrarEstadisticas && (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      gap: "20px",
      marginBottom: "20px"
    }}>

      <div style={cardStyle}>
        🏁 Mejor vuelta
        <br />
        <b>
          {mejorVueltaEvento
            ? `${mejorVueltaEvento.equipo} (${formatTime(mejorVueltaEvento.tiempo)})`
            : "-"}
        </b>
      </div>

      <div style={cardStyle}>
        ⚡ Última más rápida
        <br />
        <b>
          {mejorUltimaVuelta
            ? `${mejorUltimaVuelta.nombre} (${formatTime(mejorUltimaVuelta.ultimoTiempoVuelta)})`
            : "-"}
        </b>
      </div>

      <div style={cardStyle}>
        👑 Líder
        <br />
        <b>{lider?.nombre || "-"}</b>
      </div>

    </div>
    )}

    {/* PODIO / FOTO + RELOJ */}
<div style={{
  position:"relative",
  width:"100%",
  marginBottom:"25px",
  marginTop:"10px"
}}>

  {/* RELOJ */}
  <div style={{
    position:"absolute",
    right:"40px",
    top:"50%",
    transform:"translateY(-50%)",
    zIndex:5
  }}>

    <div style={{
      background:"#050505",
      padding:"16px 34px",
      borderRadius:"16px",
      fontSize:"32px",
      fontWeight:"bold",
      letterSpacing:"2px",
      boxShadow:"0 0 25px rgba(0,0,0,0.9)",

      color:
        tiempoRestante < 60000
          ? "#ff1744"
          : tiempoRestante < 5 * 60000
          ? "#ff9800"
          : "#00e676",

      border:`2px solid ${
        tiempoRestante < 60000
          ? "#ff1744"
          : tiempoRestante < 5 * 60000
          ? "#ff9800"
          : "#00e676"
      }`,

      minWidth:"220px",
      textAlign:"center"
    }}>

      ⏱ {formatTiempoRestante(tiempoRestante)}

    </div>

  </div>

  {/* CONTENIDO CENTRAL */}
  <div style={{
    display:"flex",
    justifyContent:"center",
    alignItems:"center"
  }}>

    {/* FOTO / PODIO */}
    {fotoActual ? (

      <div style={{
        background:"#000",
        padding:"14px",
        borderRadius:"12px",
        boxShadow:"0 0 40px rgba(0,0,0,0.9)",
        animation:"fadeFoto 0.4s ease"
      }}>

        <img
          src={fotoActual.url || fotoActual.foto}
          style={{
            width:"550px",
            borderRadius:"10px",
            animation:"zoomFoto 5s linear"
          }}
        />

        {fotoActual.equipoNombre && (
          <div style={{
            textAlign:"center",
            marginTop:"12px",
            fontSize:"26px",
            fontWeight:"bold"
          }}>
            📸 {fotoActual.equipoNombre} — vuelta {fotoActual.vuelta}
          </div>
        )}

      </div>

    ) : (

      <div style={{
        display:"flex",
        gap:"30px",
        alignItems:"flex-end"
      }}>

        {ranking.slice(0,3).map((e,index)=>{

          const distancia =
            calcularDistancia(e)

          const colores=[
            "#FFD700",
            "#C0C0C0",
            "#CD7F32"
          ]

          const alturas=[
            "110px",
            "90px",
            "75px"
          ]

          return(

            <div
              key={e.id}

              style={{
                background:"#111",
                width:"140px",
                height:alturas[index],
                borderRadius:"12px",
                border:`3px solid ${colores[index]}`,
                display:"flex",
                flexDirection:"column",
                justifyContent:"center",
                alignItems:"center",
                boxShadow:"0 0 20px rgba(255,255,255,0.15)"
              }}
            >

              <div style={{fontSize:"20px"}}>
                {["🥇","🥈","🥉"][index]}
              </div>

              <div style={{
                fontSize:"20px",
                fontWeight:"bold",
                textAlign:"center",
                padding:"0 6px"
              }}>
                {e.nombre}
              </div>

              <div style={{
  color:
    tienePenalizacion(e)
      ? "#ff9800"
      : "#fff",

  fontWeight:"bold",

  display:"flex",
  alignItems:"center",
  justifyContent:"center",
  gap:"6px"
}}>

  {tienePenalizacion(e) && (
    <span>⚠️</span>
  )}

  <span>
    {distancia} m
  </span>

</div>

            </div>

          )

        })}

      </div>

    )}

  </div>

</div>



    {/* TABLA */}

<div
  style={{

    opacity: animandoTab ? 0 : 1, 

    transform:
      animandoTab
        ? "translateY(25px)"
        : "translateY(0)",

    transition: "all 0.35s ease"
  }}
>

<table style={{
      width:"100%",
      fontSize:"26px",
      borderCollapse:"collapse",
      background:"#111",
      borderRadius:"10px",
      overflow:"hidden"
    }}>

      <thead>

        <tr style={{
          borderBottom:"3px solid #666",
          background:"#222"
        }}>

          <th>POS</th>
          <th style={{textAlign:"left"}}>EQUIPO</th>
          <th>VUELTAS</th>
          <th>ÚLTIMA</th>
          <th>GAP</th>
          <th>DISTANCIA</th>

        </tr>

      </thead>

      <tbody>

        {ranking.map((e,index)=>{

          const distancia =
            calcularDistancia(e)

          const penalizado =
            tienePenalizacion(e)

          const penalizacion =
            totalPenalizacion(e)

          let gap="---"

          if(index!==0 && lider){

            const diffVueltas=lider.vueltas-e.vueltas

            if(diffVueltas>0){

              gap=`-${diffVueltas} vuelta${diffVueltas>1?"s":""}`

            }else{

              const tiempoLider=lider.ultimoTiempoVuelta||0
              const tiempoEquipo=e.ultimoTiempoVuelta||0

              const diff = Math.abs(tiempoEquipo - tiempoLider)
              gap = `+${formatTime(diff)}`

            }

          }

          return(

            <tr
              key={e.id}
              ref={(el) => {

  if (!el) return

  const prevIndex = posicionesRef.current[e.id]

  if (prevIndex === undefined) return

  // 👇 evitar repetir misma animación
  if (animadasRef.current[e.id] === index) return

  const delta = (prevIndex - index) * 60

  if (delta !== 0) {

    animadasRef.current[e.id] = index

    el.style.transition = "none"
    el.style.transform = `translateY(${delta}px)`

    requestAnimationFrame(() => {

      requestAnimationFrame(() => {

        el.style.transition =
          "transform 0.45s ease, background 0.4s ease"

        el.style.transform = "translateY(0)"
      })

    })
  }

}}

              style={{
                borderBottom:"1px solid #333",
                background:
                  movimientos[e.id] === "up"
                    ? "#1b5e20"
                    : movimientos[e.id] === "down"
                    ? "#7f0000"
                    : index===0
                    ? "#1a1a1a"
                    : "transparent"
              }}
            >

              <td style={{textAlign:"center"}}>
                <div style={{
                  background:index===0?"#4CAF50":"#444",
                  borderRadius:"6px",
                  padding:"4px 10px",
                  display:"inline-block"
                }}>
                  {index+1}
                </div>
              </td>

              <td style={{fontWeight:index===0?"bold":"normal"}}>
                <div style={{
  display:"flex",
  alignItems:"center",
  gap:"10px"
}}>

  <span>
    {e.nombre}
  </span>

  {e.amonestado && (
    <span title="Amonestado">
      🟨
    </span>
  )}

  {e.penalizarRojoEquipo && (
    <span title="Expulsado">
      🟥
    </span>
  )}

</div>
              </td>

              <td style={{textAlign:"center"}}>
                {e.vueltas}
              </td>

              <td style={{textAlign:"center"}}>
                {formatTime(e.ultimoTiempoVuelta)}
              </td>

              <td style={{textAlign:"center"}}>
                {gap}
              </td>

              <td style={{
  textAlign:"center",
  fontWeight:"bold",

  color:
    penalizado
      ? "#ff9800"
      : "#fff",

  textShadow:
    penalizado
      ? "0 0 12px rgba(255,152,0,0.8)"
      : "none"
}}>

  <div style={{
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    gap:"8px"
  }}>

    {penalizado && (
      <span style={{
        fontSize:"22px"
      }}>
        ⚠️
      </span>
    )}

    <span>
      {distancia} m
    </span>

  </div>

</td>

            </tr>

          )

        })}

      </tbody>

    </table>

    </div>

    <style jsx>{`

      @keyframes fadeFoto{
        from{opacity:0;transform:translateY(20px)}
        to{opacity:1;transform:translateY(0)}
      }

      @keyframes zoomFoto{
        from{transform:scale(1)}
        to{transform:scale(1.08)}
      }

      @keyframes fadeSponsor{
  from{
    opacity:0;
    transform:translateY(10px);
  }

  @keyframes rotatePhone{

  0%{
    transform:rotate(0deg)
  }

  40%{
    transform:rotate(0deg)
  }

  70%{
    transform:rotate(90deg)
  }

  100%{
    transform:rotate(90deg)
  }

}

  to{
    opacity:0.9;
    transform:translateY(0);
  }
}

    `}</style>

  </div>
</>
)
}