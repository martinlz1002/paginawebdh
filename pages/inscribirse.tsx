import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import { registrarInscripcion } from "@/lib/Inscripciones";
import { ClipboardIcon, UserIcon } from "@heroicons/react/24/outline";
import type { Carrera as CarreraFull } from "@/types/carrera";

// --- Tipos ---
interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
}
interface DistanciaConCategorias {
  distancia: string;
  categorias: Categoria[];
}
interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  birthDate: Date;
}

// --- Helpers ---
function computeAge(birthDate: Date, basisDate: Date): number {
  let age = basisDate.getFullYear() - birthDate.getFullYear();
  const m = basisDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && basisDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const STRIPE_RATE = 0.041;
const FIXED_FEE = 3;
const IVA_RATE = 0.16;
function computeGross(desiredNet: number): number {
  const ivaMult = 1 + IVA_RATE;
  const raw = (desiredNet + FIXED_FEE * ivaMult) / (1 - STRIPE_RATE * ivaMult);
  let gross = Math.ceil(raw * 100) / 100;
  for (let i = 0; i < 500; i++) {
    const commission = parseFloat((gross * STRIPE_RATE + FIXED_FEE).toFixed(2));
    const iva = parseFloat((commission * IVA_RATE).toFixed(2));
    const netSim = gross - commission - iva;
    if (netSim >= desiredNet) break;
    gross = parseFloat((gross + 0.01).toFixed(2));
  }
  return gross;
}

export default function InscribirsePage() {
  const [carrera, setCarrera] = useState<CarreraFull | null>(null);
  const router = useRouter();
  const { carreraId } = router.query;
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilId, setPerfilId] = useState("");
  const [distancia, setDistancia] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<Categoria[]>([]);
  const [procesando, setProcesando] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, [auth]);

  // Carga datos de la carrera
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, "carreras", carreraId as string));
      if (snap.exists()) setCarrera({ id: snap.id, ...(snap.data() as any) } as CarreraFull);
      else setMensaje("Carrera no encontrada");
    })();
  }, [carreraId]);

  // Carga perfiles
  useEffect(() => {
    if (!user) return;
    (async () => {
      const lista: Perfil[] = [];
      const main = await getDoc(doc(db, "usuarios", user.uid));
      if (main.exists()) {
        const d = main.data() as any;
        const bd = d.fechaNacimiento instanceof Timestamp ? d.fechaNacimiento.toDate() : new Date(d.fechaNacimiento);
        lista.push({ id: user.uid, nombre: d.nombre, apellidoPaterno: d.apPaterno || d.apellidoPaterno || "", apellidoMaterno: d.apMaterno || d.apellidoMaterno || "", birthDate: bd });
      }
      const subs = await getDocs(collection(db, "usuarios", user.uid, "perfiles"));
      subs.forEach(d => {
        const p = d.data() as any;
        const bd = p.fechaNacimiento instanceof Timestamp ? p.fechaNacimiento.toDate() : new Date(p.fechaNacimiento);
        lista.push({ id: d.id, nombre: p.nombre, apellidoPaterno: p.apPaterno || p.apellidoPaterno || "", apellidoMaterno: p.apMaterno || p.apellidoMaterno || "", birthDate: bd });
      });
      setPerfiles(lista);
      if (lista.length) setPerfilId(lista[0].id);
    })();
  }, [user]);

  // Filtra categorías según edad/distancia
  useEffect(() => {
    if (!carrera || !perfilId || !distancia) return;
    const perfil = perfiles.find(p => p.id === perfilId)!;
    const basis = carrera.ageBasis === 'endOfYear' ? new Date(new Date(carrera.fecha).getFullYear(),11,31) : new Date(carrera.fecha);
    const age = computeAge(perfil.birthDate, basis);
    const distObj = carrera.distancias.find(d => d.distancia === distancia)!;
    setCategoriasPermitidas(distObj.categorias.filter(cat => age >= cat.minAge && age <= cat.maxAge));
    setCategoria('');
  }, [perfilId, distancia, carrera, perfiles]);

  // Maneja pago e inscripción
  const handlePagar = async () => {
    setMensaje("");
    if (!user || !perfilId || !distancia || !categoria || !carrera) { setMensaje("Completa todos los campos."); return; }
    setProcesando(true);

    // Evita duplicados por carrera+perfil
    const dup = await getDocs(query(
      collection(db, "inscripciones"),
      where("carreraId", "==", carrera.id),
      where("perfilId", "==", perfilId)
    ));
    if (!dup.empty) {
      setMensaje("Ya estás inscrito en esta carrera.");
      setProcesando(false);
      return;
    }

    const price = categoriasPermitidas.find(c => c.nombre === categoria)?.price ?? 0;
    const bruto = computeGross(price);
    if (!confirm(`Vas a pagar $${bruto.toFixed(2)} MXN (comisión+IVA).
¿Continuar?`)) { setProcesando(false); return; }

    try {
      const res = await fetch("/api/checkout_sessions", {
        method: "POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ carreraId: carrera.id, perfilId, categoria, distancia, price: bruto })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url, sessionId } = await res.json();
      await registrarInscripcion({ carreraId: carrera.id, carreraTitulo: carrera.titulo, perfilId, categoria, distancia, sessionId });
      window.open(url, "_blank")?.focus();
      router.push("/mis-inscripciones");
    } catch(err:any) {
      setMensaje("Error al iniciar pago: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (!carrera) {
    return <p className="text-center mt-10">{mensaje || "Cargando…"}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow space-y-6">
      {/* Información general */}
      <h1 className="text-3xl font-bold">{carrera.titulo}</h1>
      {carrera.descripcion && <p className="text-gray-700">{carrera.descripcion}</p>}
      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
        <div><strong>Fecha:</strong> {new Date(carrera.fecha).toLocaleDateString("es-MX")}</div>
        <div><strong>Lugar:</strong> {carrera.lugar}</div>
        <div><strong>Hora:</strong> {carrera.horaSalida}</div>
        {(carrera.kitFecha||carrera.kitLugar||carrera.kitHorario) && <div><strong>Kit:</strong> {carrera.kitFecha} {carrera.kitLugar} {carrera.kitHorario}</div>}
              </div>

      {/* Tabla única de distancias y categorías */}
      <table className="w-full table-auto border text-gray-700">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-1">Distancia</th>
            <th className="border px-3 py-1">Categoría</th>
            <th className="border px-3 py-1">Edad Mín</th>
            <th className="border px-3 py-1">Edad Máx</th>
            <th className="border px-3 py-1">Precio</th>
          </tr>
        </thead>
        <tbody>
          {carrera.distancias.flatMap(d =>
            d.categorias.map(cat => (
              <tr key={`${d.distancia}-${cat.nombre}`}>             
                <td className="border px-3 py-1">{d.distancia}</td>
                <td className="border px-3 py-1">{cat.nombre}</td>
                <td className="border px-3 py-1">{cat.minAge}</td>
                <td className="border px-3 py-1">{cat.maxAge}</td>
                <td className="border px-3 py-1">${cat.price} + IVA</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Formulario de inscripción */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <select className="border p-2 rounded" value={perfilId} onChange={e => setPerfilId(e.target.value)}>
          {perfiles.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellidoPaterno}</option>)}
        </select>
        <select className="border p-2 rounded" value={distancia} onChange={e => setDistancia(e.target.value)}>
          <option value="">Selecciona distancia</option>
          {carrera.distancias.map(d => <option key={d.distancia} value={d.distancia}>{d.distancia}</option>)}
        </select>
        <select className="border p-2 rounded" value={categoria} onChange={e => setCategoria(e.target.value)} disabled={!categoriasPermitidas.length}>
          <option value="">Selecciona categoría</option>
          {categoriasPermitidas.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
        </select>
      </div>

      <button
        onClick={handlePagar}
        disabled={!perfilId || !categoria || procesando}
        className={`w-full py-2 rounded text-white ${perfilId && categoria ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'}`}>
        {procesando ? 'Procesando...' : `Inscribirme y Pagar $${computeGross(categoriasPermitidas.find(c=>c.nombre===categoria)?.price||0).toFixed(2)}`}
      </button>
      {mensaje && <p className="text-center text-red-600">{mensaje}</p>}
    </div>
  );
}
