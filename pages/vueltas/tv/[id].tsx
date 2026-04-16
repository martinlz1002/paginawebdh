import { useRouter } from "next/router"
import { useRef } from "react"
import { useEffect, useMemo, useState } from "react"
import { doc, collection, onSnapshot, query, orderBy, limit } from "firebase/firestore"
import { db } from "../../../lib/firebase"
import { where } from "firebase/firestore"

type Equipo = {
  id: string
  nombre: string
  vueltas: number
  metrosExtra?: number
  ultimoTiempoVuelta?: number
  ultimaVuelta?: number
}

type Evento = {
  nombreEvento?: string
  longitudPista: number
}

type FotoEvento = {
  id: string
  foto: string
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

  const primerCargaRef = useRef(true)

  const [mejorVueltaEvento, setMejorVueltaEvento] = useState<{
  equipo: string
  tiempo: number
} | null>(null)

const [highlight, setHighlight] = useState<string | null>(null)

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

  // 👉 SOLO esto se queda
const [inicioTV, setInicioTV] = useState<number | null>(null)

useEffect(() => {
  setInicioTV(Date.now())
}, [])


// 🔹 EVENTO + EQUIPOS (igual)
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

  const ranking = useMemo(() => {

  return [...equipos].sort((a, b) => {

    const distA = a.vueltas * pista + (a.metrosExtra || 0)
    const distB = b.vueltas * pista + (b.metrosExtra || 0)

    // 🥇 1. ordenar por distancia
    if (distB !== distA) {
      return distB - distA
    }

    // 🥈 2. desempate por quién llegó primero
    const tiempoA = a.ultimaVuelta || 0
    const tiempoB = b.ultimaVuelta || 0

    return tiempoA - tiempoB

  })

}, [equipos, pista])


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
    boxShadow: "0 0 20px rgba(255,152,0,0.7)",
    zIndex: 999,
    animation: "fadeSlide 0.4s ease"
  }}>
    {highlight}
  </div>
)}

return (

  

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
  fontSize:"56px",
  marginBottom:"30px"
}}>
{evento?.nombreEvento || "Carrera"}
</h1>

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

{/* PODIO / FOTO */}

<div style={{
  display:"flex",
  justifyContent:"center",
  alignItems:"center",
  gap:"40px",
  paddingTop:"5px",
  marginBottom:"20px"
}}>

  {/* 🔥 LOGO */}
  <img
    src="/zarigueyas_white.png"
    style={{
      width:"140px",
      objectFit:"contain",
      opacity:0.95,
      filter:"drop-shadow(0 0 10px rgba(0,0,0,0.8))"
    }}
  />

  {/* 🔥 CONTENEDOR PODIO / FOTO */}
  {fotoActual ? (

    <div style={{
      background:"#000",
      padding:"14px",
      borderRadius:"12px",
      boxShadow:"0 0 40px rgba(0,0,0,0.9)",
      animation:"fadeFoto 0.4s ease"
    }}>

<img
src={fotoActual.foto}
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

const distancia = e.vueltas * pista + (e.metrosExtra || 0)

const colores=["#FFD700","#C0C0C0","#CD7F32"]
const alturas=["110px","90px","75px"]

return(

<div key={e.id}

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
fontWeight:"bold"
}}>
{e.nombre}
</div>

<div>
{distancia} m
</div>

</div>

)

})}

</div>

)}

</div>


{/* TABLA */}

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

const distancia = e.vueltas * pista + (e.metrosExtra || 0)

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

    const delta = (prevIndex - index) * 60

    if (delta !== 0) {
      el.style.transform = `translateY(${delta}px)`
      el.style.transition = "none"

      requestAnimationFrame(() => {
        el.style.transform = "translateY(0)"
        el.style.transition = "transform 0.35s ease, background 0.4s ease"
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
{e.nombre}
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
fontWeight:"bold"
}}>
{distancia} m
</td>

</tr>

)

})}

</tbody>

</table>


<style jsx>{`

@keyframes fadeFoto{
from{opacity:0;transform:translateY(20px)}
to{opacity:1;transform:translateY(0)}
}

@keyframes zoomFoto{
from{transform:scale(1)}
to{transform:scale(1.08)}
}

`}</style>

</div>

)
}