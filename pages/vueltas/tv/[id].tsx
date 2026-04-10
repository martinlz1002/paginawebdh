import { useRouter } from "next/router"
import { useRef } from "react"
import { useEffect, useMemo, useState } from "react"
import { doc, collection, onSnapshot, query, orderBy, limit } from "firebase/firestore"
import { db } from "../../../lib/firebase"

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

  const [fotosMostradas, setFotosMostradas] = useState<Set<string>>(new Set())

  // cargar fotos ya mostradas desde localStorage
  useEffect(() => {

    const guardadas = localStorage.getItem("fotosMostradas")

    if (guardadas) {
      setFotosMostradas(new Set(JSON.parse(guardadas)))
    }

  }, [])


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


  // ESCUCHAR FOTOS
  useEffect(() => {

    if (!id) return

    const fotosRef = query(
      collection(db, "eventos_vueltas", id as string, "fotos_evento"),
      orderBy("timestamp", "desc"),
      limit(20)
    )

    const unsub = onSnapshot(fotosRef, snapshot => {

      snapshot.docChanges().forEach(change => {

        if (change.type === "added") {

          const data = change.doc.data() as Omit<FotoEvento, "id">

const nuevaFoto: FotoEvento = {
  id: change.doc.id,
  ...data
}

          if (fotosMostradas.has(nuevaFoto.id)) return

          setColaFotos(prev => [...prev, nuevaFoto])

        }

      })

    })

    return () => unsub()

  }, [id, fotosMostradas])


  // COLA DE FOTOS
  useEffect(() => {

    if (mostrando) return
    if (colaFotos.length === 0) return

    const siguiente = colaFotos[0]

    setFotoActual(siguiente)
    setMostrando(true)

    setTimeout(() => {

      if (siguiente) {

        const nuevas = new Set(fotosMostradas)
        nuevas.add(siguiente.id)

        setFotosMostradas(nuevas)

        localStorage.setItem(
          "fotosMostradas",
          JSON.stringify(Array.from(nuevas))
        )
      }

      setFotoActual(null)
      setColaFotos(prev => prev.slice(1))
      setMostrando(false)

    }, 5000)

  }, [colaFotos, mostrando, fotosMostradas])


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

return (

<div style={{
  background:"linear-gradient(180deg,#050505,#111)",
  color:"#fff",
  minHeight:"100vh",
  padding:"30px",
  fontFamily:"system-ui"
}}>

<h1 style={{
  textAlign:"center",
  fontSize:"56px",
  marginBottom:"30px"
}}>
{evento?.nombreEvento || "Carrera"}
</h1>


{/* PODIO / FOTO */}

<div style={{
  display:"flex",
  justifyContent:"center",
  alignItems:"center",
  height:"260px",
  marginBottom:"40px"
}}>

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
gap:"40px",
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