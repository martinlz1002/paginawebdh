import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import { doc, collection, onSnapshot } from "firebase/firestore"
import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage"
import { db } from "../../../lib/firebase"

type Equipo = {
  id: string
  nombre: string
  vueltas: number
  metrosExtra?: number
  ultimoTiempoVuelta?: number
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

  const storage = getStorage()

  // SISTEMA DE FOTOS
  const [fotoActual, setFotoActual] = useState<string | null>(null)
  const [colaFotos, setColaFotos] = useState<string[]>([])
  const [mostrando, setMostrando] = useState(false)
  const [fotosDetectadas, setFotosDetectadas] = useState<Set<string>>(new Set())

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


  // DETECTAR FOTOS NUEVAS EN STORAGE
  useEffect(() => {

    if (!evento?.nombreEvento) return

    const intervalo = setInterval(async () => {

      try {

        const carpeta = ref(storage, `laps/${evento.nombreEvento}`)

        const lista = await listAll(carpeta)

        for (const item of lista.items) {

          if (!fotosDetectadas.has(item.fullPath)) {

            const url = await getDownloadURL(item)

            setColaFotos(prev => [...prev, url])

            setFotosDetectadas(prev => new Set(prev).add(item.fullPath))

          }

        }

      } catch (e) {
        console.log("error leyendo fotos", e)
      }

    }, 2000)

    return () => clearInterval(intervalo)

  }, [evento])


  // REPRODUCCIÓN DE COLA
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

    }, 4000)

  }, [colaFotos, mostrando])


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

  const lider = ranking[0]

return (

<div style={{
  background: "linear-gradient(180deg,#050505,#111)",
  color: "#fff",
  minHeight: "100vh",
  padding: "40px",
  fontFamily: "system-ui, sans-serif"
}}>

<h1 style={{
  textAlign: "center",
  fontSize: "56px",
  marginBottom: "30px",
  letterSpacing: "2px"
}}>
{evento?.nombreEvento || "Carrera"}
</h1>


{/* PODIO */}

<div style={{
  display: "flex",
  justifyContent: "center",
  gap: "30px",
  marginBottom: "40px"
}}>

{ranking.slice(0,3).map((e,index)=>{

const distancia = e.vueltas * pista + (e.metrosExtra || 0)

const colores = ["#FFD700","#C0C0C0","#CD7F32"]

return(

<div key={e.id}
style={{
  background:"#111",
  padding:"20px 30px",
  borderRadius:"10px",
  textAlign:"center",
  border:`3px solid ${colores[index]}`,
  boxShadow:"0 0 15px rgba(255,255,255,0.2)",
  transform:index===0?"scale(1.1)":"scale(1)"
}}>

<div style={{fontSize:"24px"}}>
{["🥇","🥈","🥉"][index]}
</div>

<div style={{
fontSize:"30px",
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


<table style={{
  width: "100%",
  fontSize: "26px",
  borderCollapse: "collapse",
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

const diff=tiempoEquipo-tiempoLider

gap=`+${formatTime(diff)}`

}

}

return(

<tr key={e.id}

style={{
borderBottom:"1px solid #333",
background:index===0?"#1a1a1a":"transparent",
transition:"all 0.4s ease",
transform:index===0?"scale(1.02)":"scale(1)"
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

<td style={{
fontWeight:index===0?"bold":"normal",
fontSize:index===0?"30px":"26px"
}}>
{e.nombre}
</td>

<td style={{textAlign:"center"}}>
{e.vueltas}
</td>

<td style={{textAlign:"center"}}>
{formatTime(e.ultimoTiempoVuelta)}
</td>

<td style={{
textAlign:"center",
color:index===0?"#4CAF50":"#aaa"
}}>
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


{/* FOTO OVERLAY */}

{fotoActual && (

<div style={{

position:"fixed",
bottom:"40px",
right:"40px",
background:"#000",
padding:"12px",
borderRadius:"10px",
boxShadow:"0 0 40px rgba(0,0,0,0.9)",
zIndex:999,
animation:"fadeFoto 0.5s ease"

}}>

<img
src={fotoActual}
style={{
width:"420px",
borderRadius:"8px",
animation:"zoomFoto 4s linear"
}}
/>

</div>

)}

<style jsx>{`

@keyframes fadeFoto {

from{
opacity:0;
transform:translateY(20px);
}

to{
opacity:1;
transform:translateY(0);
}

}

@keyframes zoomFoto {

from{
transform:scale(1);
}

to{
transform:scale(1.08);
}

}

`}</style>


</div>

)
}