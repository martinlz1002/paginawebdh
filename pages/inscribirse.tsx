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
type AgeBasis = "endOfYear" | "eventDate";

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  fecha?: string;
  horaSalida?: string;
  bannerUrl?: string;
  distancias: DistanciaConCategorias[];
  ageBasis: AgeBasis;
}

interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  birthDate: Date;
}

// --- Cálculo de edad ---
function computeAge(birthDate: Date, basisDate: Date): number {
  let age = basisDate.getFullYear() - birthDate.getFullYear();
  const m = basisDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && basisDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// --- Cálculo de precio bruto con comisión + IVA ---
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
  const router = useRouter();
  const { carreraId } = router.query;
  const auth = getAuth(app);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState("");
  const [edadPerfil, setEdadPerfil] = useState<number>(0);
  const [distanciaSeleccionada, setDistanciaSeleccionada] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<Categoria[]>([]);
  const [procesandoPago, setProcesandoPago] = useState(false);

  // Autenticación
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setCurrentUser);
    return () => unsub();
  }, []);

  // Carga carrera
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, "carreras", carreraId as string));
      if (!snap.exists()) {
        setMensaje("Carrera no encontrada");
        return;
      }
      const d = snap.data();
      setCarrera({
        id: snap.id,
        titulo: d.titulo,
        descripcion: d.descripcion,
        lugar: d.lugar || d.ubicacion,
        fecha:
          d.fecha instanceof Timestamp
            ? d.fecha.toDate().toISOString().split("T")[0]
            : d.fecha,
        horaSalida: d.horaSalida,
        bannerUrl: d.bannerUrl,
        distancias: d.distancias || [],
        ageBasis: d.ageBasis || "endOfYear",
      });
    })();
  }, [carreraId]);

  // Carga perfiles del usuario
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const lista: Perfil[] = [];

      const udoc = await getDoc(doc(db, "usuarios", currentUser.uid));
      if (udoc.exists()) {
        const ud = udoc.data();
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

      const sub = await getDocs(collection(db, "usuarios", currentUser.uid, "perfiles"));
      sub.forEach(d => {
        const p = d.data();
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
      if (lista.length > 0) setPerfilSeleccionado(lista[0].id);
    })();
  }, [currentUser]);

  // Calcula edad y categorías disponibles
  useEffect(() => {
    if (!perfilSeleccionado || !carrera || !distanciaSeleccionada) return;

    const perfil = perfiles.find(p => p.id === perfilSeleccionado);
    if (!perfil) return;

    const eventDate = carrera.ageBasis === "endOfYear"
      ? new Date(new Date(carrera.fecha!).getFullYear(), 11, 31)
      : new Date(carrera.fecha!);

    const edad = computeAge(perfil.birthDate, eventDate);
    setEdadPerfil(edad);

    const distancia = carrera.distancias.find(d => d.distancia === distanciaSeleccionada);
    if (!distancia) return;

    const permitidas = distancia.categorias.filter(c =>
      edad >= c.minAge && edad <= c.maxAge
    );

    setCategoriasPermitidas(permitidas);
    setCategoriaSeleccionada(""); // reset categoría
  }, [perfilSeleccionado, carrera, distanciaSeleccionada]);

  const categoriaElegida = categoriasPermitidas.find(c => c.nombre === categoriaSeleccionada);
  const precioSeleccionado = categoriaElegida?.price ?? 0;

  const handlePagar = async () => {
    setMensaje("");
    if (!currentUser || !perfilSeleccionado || !distanciaSeleccionada || !categoriaSeleccionada) {
      setMensaje("Completa todos los campos.");
      return;
    }

    const netoDeseado = precioSeleccionado;
    const bruto = computeGross(netoDeseado);

    if (!window.confirm(`Vas a pagar $${bruto.toFixed(2)} MXN (incluye comisión + IVA)\n¿Deseas continuar?`)) {
      return;
    }

    setProcesandoPago(true);
    if (!carrera) {
  setMensaje("Error: carrera no cargada.");
  return;
}
    try {
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

      await registrarInscripcion({
  carreraId: carrera!.id,
  carreraTitulo: carrera!.titulo,
  perfilId: perfilSeleccionado,
  categoria: categoriaSeleccionada,
  distancia: distanciaSeleccionada,
  sessionId,
});

      window.open(url, "_blank")?.focus();
      router.push("/mis-inscripciones");
    } catch (e: any) {
      setMensaje("Error al iniciar pago: " + e.message);
    } finally {
      setProcesandoPago(false);
    }
  };

  if (!carrera) return <p className="text-center mt-10">{mensaje || "Cargando…"}</p>;

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow overflow-hidden">
      {carrera.bannerUrl && (
        <div className="h-56 bg-cover bg-center" style={{ backgroundImage: `url(${carrera.bannerUrl})` }} />
      )}
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">{carrera.titulo}</h1>
        {carrera.descripcion && <p className="text-gray-700">{carrera.descripcion}</p>}

        {/* Tabla de distancias y categorías */}
        {carrera.distancias.map((d) => (
          <div key={d.distancia}>
            <h3 className="text-lg font-semibold mt-4 mb-1 text-purple-700">{d.distancia}</h3>
            <table className="w-full table-auto border text-gray-700 mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2">Categoría</th>
                  <th className="border px-4 py-2">Edad mínima</th>
                  <th className="border px-4 py-2">Edad máxima</th>
                  <th className="border px-4 py-2">Precio (MXN + IVA)</th>
                </tr>
              </thead>
              <tbody>
                {d.categorias.map((cat) => (
                  <tr key={cat.nombre}>
                    <td className="border px-4 py-2">{cat.nombre}</td>
                    <td className="border px-4 py-2">{cat.minAge}</td>
                    <td className="border px-4 py-2">{cat.maxAge}</td>
                    <td className="border px-4 py-2">${computeGross(cat.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Selección de perfil, distancia y categoría */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select className="p-2 border rounded" value={perfilSeleccionado} onChange={e => setPerfilSeleccionado(e.target.value)}>
            <option value="">Selecciona perfil</option>
            {perfiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}
              </option>
            ))}
          </select>

          <select className="p-2 border rounded" value={distanciaSeleccionada} onChange={e => setDistanciaSeleccionada(e.target.value)}>
            <option value="">Selecciona distancia</option>
            {carrera.distancias.map(d => (
              <option key={d.distancia} value={d.distancia}>{d.distancia}</option>
            ))}
          </select>

          <select className="p-2 border rounded" value={categoriaSeleccionada} onChange={e => setCategoriaSeleccionada(e.target.value)} disabled={!categoriasPermitidas.length}>
            <option value="">Selecciona categoría</option>
            {categoriasPermitidas.map(c => (
              <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Edad y precio */}
        <p className="text-sm text-gray-600">Edad calculada: {edadPerfil} años</p>
        {categoriaSeleccionada && (
          <p className="text-lg font-medium">Precio seleccionado: ${computeGross(precioSeleccionado).toFixed(2)}</p>
        )}

        {/* Botón de pago */}
        {currentUser ? (
          <button
            onClick={handlePagar}
            disabled={!perfilSeleccionado || !distanciaSeleccionada || !categoriaSeleccionada || procesandoPago}
            className={`w-full py-3 rounded text-white transition ${
              perfilSeleccionado && categoriaSeleccionada
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {procesandoPago ? "Procesando..." : `Inscribirme y Pagar $${computeGross(precioSeleccionado).toFixed(2)}`}
          </button>
        ) : (
          <Link href="/login">
            <a className="text-blue-600 underline block text-center">Inicia sesión para inscribirte</a>
          </Link>
        )}

        {mensaje && <p className="text-center text-red-600">{mensaje}</p>}
      </div>
    </div>
  );
}