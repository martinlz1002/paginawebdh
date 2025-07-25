import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { app, db } from "@/lib/firebase";
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
import { registrarInscripcion } from "@/lib/Inscripciones";
import {
  ClipboardIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

// --- Tipos ---
interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
  distancia?: string;
}
type AgeBasis = "endOfYear" | "eventDate";
interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  fecha?: string; // YYYY-MM-DD
  horaSalida?: string;
  bannerUrl?: string;
  categorias: Categoria[];
  ageBasis: AgeBasis;
}
interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  birthDate: Date;
}
type CategoriaExtendida = Categoria & { distancia?: string };

// Calcula edad
function computeAge(birthDate: Date, basisDate: Date): number {
  let age = basisDate.getFullYear() - birthDate.getFullYear();
  const m = basisDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && basisDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Comisión y IVA
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
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [competitorNumber, setCompetitorNumber] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [loadingPerfiles, setLoadingPerfiles] = useState(true);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [perfilAge, setPerfilAge] = useState(0);
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<CategoriaExtendida[]>([]);
  const auth = getAuth(app);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, "carreras", carreraId as string));
      if (!snap.exists()) {
        setMensaje("Carrera no encontrada");
        return;
      }
      const d: any = snap.data();
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
        categorias: (d.categorias || []).map((cat: any) => ({
          nombre: cat.nombre,
          minAge: cat.minAge,
          maxAge: cat.maxAge,
          price: typeof cat.price === "number" ? cat.price : 0,
          distancia: cat.distancia || "",
        })),
        ageBasis: d.ageBasis || "endOfYear",
      });
    })();
  }, [carreraId]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      setLoadingPerfiles(true);
      const lista: Perfil[] = [];

      const udoc = await getDoc(doc(db, "usuarios", currentUser.uid));
      if (udoc.exists()) {
        const ud: any = udoc.data();
        const bd =
          ud.fechaNacimiento instanceof Timestamp
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

      const snap = await getDocs(
        collection(db, "usuarios", currentUser.uid, "perfiles")
      );
      snap.docs.forEach(d => {
        const p: any = d.data();
        const bd =
          p.fechaNacimiento instanceof Timestamp
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
      setLoadingPerfiles(false);
    })();
  }, [currentUser]);

  useEffect(() => {
    setCategoriaSeleccionada("");
    setCompetitorNumber(null);
  }, [perfilSeleccionado]);

  useEffect(() => {
    if (!perfilSeleccionado || !carrera) {
      setCategoriasPermitidas([]);
      return;
    }

    const perfilData = perfiles.find((p) => p.id === perfilSeleccionado);
    if (!perfilData) {
      setCategoriasPermitidas([]);
      return;
    }

    const eventYear = carrera.fecha ? new Date(carrera.fecha).getFullYear() : new Date().getFullYear();
    const basisDate =
      carrera.ageBasis === "endOfYear"
        ? new Date(eventYear, 11, 31)
        : carrera.fecha
        ? new Date(carrera.fecha)
        : new Date();

    const edad = computeAge(perfilData.birthDate, basisDate);
    setPerfilAge(edad);

    const permitidas: CategoriaExtendida[] = carrera.categorias
      .filter((cat) => edad >= cat.minAge && edad <= cat.maxAge)
      .map((cat) => ({ ...cat }));

    setCategoriasPermitidas(permitidas);
  }, [perfilSeleccionado, carrera, perfiles]);

  const categoriaElegida = categoriasPermitidas.find((c) => c.nombre === categoriaSeleccionada);
  const precioSeleccionado = categoriaElegida?.price ?? 0;

  const handlePagar = async () => {
    setMensaje("");
    if (!perfilSeleccionado || !categoriaSeleccionada || !currentUser) {
      setMensaje("Selecciona perfil, categoría e inicia sesión");
      return;
    }
    if (!carrera) return;

    const dupAny = await getDocs(
      query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carrera.id),
        where("perfilId", "==", perfilSeleccionado),
        where("perfilOwner", "==", currentUser.uid)
      )
    );
    if (!dupAny.empty) {
      setMensaje("Ya estás inscrito en esta carrera.");
      return;
    }

    const netoDeseado = precioSeleccionado;
    const bruto = computeGross(netoDeseado);

    if (
      !window.confirm(
        `Vas a pagar $${bruto.toFixed(2)} MXN (incluye comisión + IVA)\n¿Deseas continuar?`
      )
    ) {
      return;
    }

    setProcesandoPago(true);
    try {
      const resp = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carreraId: carrera.id,
          perfilId: perfilSeleccionado,
          categoria: categoriaSeleccionada,
          price: bruto,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { url, sessionId } = await resp.json();

      await registrarInscripcion({
        carreraId: carrera.id,
        carreraTitulo: carrera.titulo,
        perfilId: perfilSeleccionado,
        categoria: categoriaSeleccionada,
        sessionId,
      });

      const insSnap = await getDocs(
        query(
          collection(db, "inscripciones"),
          where("sessionId", "==", sessionId)
        )
      );
      if (!insSnap.empty) {
        const data: any = insSnap.docs[0].data();
        setCompetitorNumber(data.competitorNumber ?? null);
      }

      window.open(url, "_blank")?.focus();
      router.push("/mis-inscripciones");
    } catch (e: any) {
      console.error(e);
      setMensaje(`Error al iniciar pago: ${e.message}`);
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
        {carrera.descripcion && <p className="text-gray-700">{carrera.descripcion}</p>}

        {carrera.categorias.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2">
              <ClipboardIcon className="w-6 h-6 text-green-700" />
              <span>Categorías y precios</span>
            </h2>
            <table className="w-full table-auto border text-gray-700">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2">Categoría</th>
                  <th className="border px-4 py-2">Distancia</th>
                  <th className="border px-4 py-2">Edad mínima</th>
                  <th className="border px-4 py-2">Edad máxima</th>
                  <th className="border px-4 py-2">Precio total (MXN)</th>
                </tr>
              </thead>
              <tbody>
                {carrera.categorias.map((cat) => (
                  <tr key={cat.nombre} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">{cat.nombre}</td>
                    <td className="border px-4 py-2">{cat.distancia || "-"}</td>
                    <td className="border px-4 py-2">{cat.minAge}</td>
                    <td className="border px-4 py-2">{cat.maxAge}</td>
                    <td className="border px-4 py-2">
                      ${computeGross(cat.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-gray-100 rounded">
          <p className="font-medium">Edad en base a la convocatoria: {perfilAge} años</p>
          <p className="text-sm text-gray-600">
            Según {carrera.ageBasis === "endOfYear"
              ? `corte al 31/12/${new Date(carrera.fecha!).getFullYear()}`
              : `fecha del evento (${carrera.fecha})`}
          </p>
          <p className="text-sm mt-2">
            Categorías disponibles:{" "}
            {categoriasPermitidas.length > 0
              ? categoriasPermitidas.map(c => c.nombre).join(", ")
              : "Ninguna categoría disponible para esta edad"}
          </p>
        </div>

        {/* Selector de perfil */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1 flex items-center space-x-1">
              <UserIcon className="w-5 h-5 text-green-600" />
              <span>Tu perfil</span>
            </label>
            {loadingPerfiles ? (
              <p>Cargando perfiles…</p>
            ) : (
              <select
                className="w-full border p-2 rounded"
                value={perfilSeleccionado}
                onChange={e => setPerfilSeleccionado(e.target.value)}
              >
                {perfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {`${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno} (${computeAge(p.birthDate, new Date())} años)`}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block font-medium mb-1 flex items-center space-x-1">
              <ClipboardIcon className="w-5 h-5 text-purple-700" />
              <span>Categoría</span>
            </label>
            <select
              className="w-full border p-2 rounded disabled:opacity-50"
              value={categoriaSeleccionada}
              onChange={e => setCategoriaSeleccionada(e.target.value)}
              disabled={!categoriasPermitidas.length}
            >
              <option value="">-- Selecciona categoría --</option>
              {categoriasPermitidas.map(cat => (
                <option key={cat.nombre} value={cat.nombre}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {categoriaSeleccionada && (
          <div className="text-lg font-medium">
            Precio seleccionado: ${precioSeleccionado.toFixed(2)}
          </div>
        )}

        {currentUser ? (
          <button
            onClick={handlePagar}
            disabled={
              !perfilSeleccionado ||
              !categoriaSeleccionada ||
              procesandoPago
            }
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
        ) : (
          <div className="text-center">
            <Link href="/login">
              <a className="text-blue-600 underline">
                Inicia sesión para inscribirte
              </a>
            </Link>
          </div>
        )}

        {mensaje && <p className="text-center text-red-600">{mensaje}</p>}
      </div>
    </div>
  );
}