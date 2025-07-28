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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState("");
  const [edadPerfil, setEdadPerfil] = useState<number>(0);
  const [distanciaSeleccionada, setDistanciaSeleccionada] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<Categoria[]>([]);
  const [procesandoPago, setProcesandoPago] = useState(false);

  // Monitorea auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setCurrentUser);
    return () => unsub();
  }, [auth]);

  // Carga la carrera
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, "carreras", carreraId as string));
      if (!snap.exists()) {
        setMensaje("Carrera no encontrada");
        return;
      }
      setCarrera({ id: snap.id, ...(snap.data() as any) } as CarreraFull);
    })();
  }, [carreraId]);

  // Carga perfiles del usuario
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const lista: Perfil[] = [];
      // Perfil principal
      const udoc = await getDoc(doc(db, "usuarios", currentUser.uid));
      if (udoc.exists()) {
        const ud = udoc.data() as any;
        const bd = ud.fechaNacimiento instanceof Timestamp
          ? ud.fechaNacimiento.toDate()
          : new Date(ud.fechaNacimiento);
        lista.push({
          id: currentUser.uid,
          nombre: ud.nombre,
          apellidoPaterno: ud.apPaterno ?? ud.apellidoPaterno ?? "",
          apellidoMaterno: ud.apMaterno ?? ud.apellidoMaterno ?? "",
          birthDate: bd,
        });
      }
      // Subperfiles
      const sub = await getDocs(collection(db, "usuarios", currentUser.uid, "perfiles"));
      sub.forEach(d => {
        const p = d.data() as any;
        const bd = p.fechaNacimiento instanceof Timestamp
          ? p.fechaNacimiento.toDate()
          : new Date(p.fechaNacimiento);
        lista.push({
          id: d.id,
          nombre: p.nombre,
          apellidoPaterno: p.apPaterno ?? p.apellidoPaterno ?? "",
          apellidoMaterno: p.apMaterno ?? p.apellidoMaterno ?? "",
          birthDate: bd,
        });
      });
      setPerfiles(lista);
      if (lista.length) setPerfilSeleccionado(lista[0].id);
    })();
  }, [currentUser]);

  // Calcula edad y categorías disponibles
  useEffect(() => {
    if (!perfilSeleccionado || !carrera || !distanciaSeleccionada) return;
    const perfil = perfiles.find(p => p.id === perfilSeleccionado)!;
    const eventDate = carrera.ageBasis === "endOfYear"
      ? new Date(new Date(carrera.fecha).getFullYear(), 11, 31)
      : new Date(carrera.fecha);
    setEdadPerfil(computeAge(perfil.birthDate, eventDate));
    const distObj = carrera.distancias.find(d => d.distancia === distanciaSeleccionada)!;
    setCategoriasPermitidas(
      distObj.categorias.filter(cat =>
        edadPerfil >= cat.minAge && edadPerfil <= cat.maxAge
      )
    );
    setCategoriaSeleccionada("");
  }, [perfilSeleccionado, carrera, distanciaSeleccionada, perfiles, edadPerfil]);

  const precioSeleccionado = categoriasPermitidas.find(c => c.nombre === categoriaSeleccionada)?.price ?? 0;

  const handlePagar = async () => {
    setMensaje("");
    if (!currentUser || !perfilSeleccionado || !distanciaSeleccionada || !categoriaSeleccionada || !carrera) {
      setMensaje("Completa todos los campos.");
      return;
    }

    setProcesandoPago(true);

    // 🚫 Evitar duplicados: mismo perfil en misma carrera (independiente de distancia/categoría)
    const dupSnap = await getDocs(
      query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carrera.id),
        where("perfilId", "==", perfilSeleccionado)
      )
    );
    if (!dupSnap.empty) {
      setMensaje("Ya estás inscrito en esta carrera.");
      setProcesandoPago(false);
      return;
    }

    // Calcular monto bruto
    const bruto = computeGross(precioSeleccionado);
    if (!window.confirm(`Vas a pagar $${bruto.toFixed(2)} MXN (incluye comisión + IVA)\n¿Deseas continuar?`)) {
      setProcesandoPago(false);
      return;
    }

    try {
      // Crear sesión Stripe
      const resp = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carreraId: carrera.id,
          perfilId: perfilSeleccionado,
          categoria: categoriaSeleccionada,
          distancia: distanciaSeleccionada,
          price: bruto,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { url, sessionId } = await resp.json();

      // Registrar en Firestore
      await registrarInscripcion({
        carreraId: carrera.id,
        carreraTitulo: carrera.titulo,
        perfilId: perfilSeleccionado,
        categoria: categoriaSeleccionada,
        distancia: distanciaSeleccionada,
        sessionId,
      });

      // Redirigir
      window.open(url, "_blank")?.focus();
      router.push("/mis-inscripciones");
    } catch (e: any) {
      setMensaje("Error al iniciar pago: " + e.message);
    } finally {
      setProcesandoPago(false);
    }
  };

  if (!carrera) {
    return <p className="text-center mt-10">{mensaje || "Cargando…"}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow overflow-hidden">
      {carrera.bannerUrl && (
        <div
          className="h-56 bg-cover bg-center"
          style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
        />
      )}
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">{carrera.titulo}</h1>

        {/* Selección de perfil, distancia y categoría */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Perfil */}
          <div>
            <label className="block font-medium mb-1 flex items-center space-x-1">
              <UserIcon className="w-5 h-5 text-green-600" />
              <span>Tu perfil</span>
            </label>
            <select
              className="w-full border p-2 rounded"
              value={perfilSeleccionado}
              onChange={e => setPerfilSeleccionado(e.target.value)}
            >
              {perfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}
                </option>
              ))}
            </select>
          </div>
          {/* Distancia */}
          <div>
            <label className="block font-medium mb-1">Distancia</label>
            <select
              className="w-full border p-2 rounded"
              value={distanciaSeleccionada}
              onChange={e => setDistanciaSeleccionada(e.target.value)}
            >
              <option value="">-- Selecciona distancia --</option>
              {carrera.distancias.map(d => (
                <option key={d.distancia} value={d.distancia}>
                  {d.distancia}
                </option>
              ))}
            </select>
          </div>
          {/* Categoría */}
          <div>
            <label className="block font-medium mb-1">Categoría</label>
            <select
              className="w-full border p-2 rounded"
              value={categoriaSeleccionada}
              onChange={e => setCategoriaSeleccionada(e.target.value)}
              disabled={!categoriasPermitidas.length}
            >
              <option value="">-- Selecciona categoría --</option>
              {categoriasPermitidas.map(c => (
                <option key={c.nombre} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botón de pago y mensaje */}
        <button
          onClick={handlePagar}
          disabled={!perfilSeleccionado || procesandoPago}
          className={`w-full py-3 rounded text-white transition ${
            perfilSeleccionado && categoriaSeleccionada
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {procesandoPago
            ? "Procesando..."
            : `Inscribirme y Pagar $${computeGross(precioSeleccionado).toFixed(2)}`}
        </button>
        {mensaje && <p className="text-center text-red-600">{mensaje}</p>}
      </div>
    </div>
  );
}