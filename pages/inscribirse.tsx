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

// Tipos
interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
}
interface Distancia {
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
  distancias: Distancia[];
  ageBasis: AgeBasis;
}
interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  birthDate: Date;
}

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
  const auth = getAuth(app);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
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
        distancias: d.distancias || [],
        ageBasis: d.ageBasis || "endOfYear",
      });
    })();
  }, [carreraId]);

  const tablaCategorias = carrera?.distancias.flatMap((d) =>
    d.categorias.map((cat) => (
      <tr key={`${d.distancia}-${cat.nombre}`} className="hover:bg-gray-50">
        <td className="border px-4 py-2">{d.distancia}</td>
        <td className="border px-4 py-2">{cat.nombre}</td>
        <td className="border px-4 py-2">{cat.minAge}</td>
        <td className="border px-4 py-2">{cat.maxAge}</td>
        <td className="border px-4 py-2">${cat.price.toFixed(2)}</td>
      </tr>
    ))
  );

  // Carga perfiles del usuario autenticado
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      setLoadingPerfiles(true);
      const lista: Perfil[] = [];

      // Perfil principal
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

      // Subperfiles
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

  // Reset al cambiar perfil
  useEffect(() => {
    setCategoriaSeleccionada("");
    setCompetitorNumber(null);
  }, [perfilSeleccionado]);

  const handlePagar = async () => {
    setMensaje("");
    if (!perfilSeleccionado || !categoriaSeleccionada || !currentUser) {
      setMensaje("Selecciona perfil, categoría e inicia sesión");
      return;
    }
    if (!carrera) return;

    // Evitar duplicados
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

    // Precio base neto
    const categoriaElegida = categoriasDisponibles.find((c) => c.nombre === categoriaSeleccionada);
const precioSeleccionado = categoriaElegida?.price ?? 0;

    // Calculamos bruto para que neto queden `netoDeseado`
    const bruto = computeGross(precioSeleccionado);

    // Confirmación al usuario
    if (
      !window.confirm(
        `Vas a pagar $${bruto.toFixed(
          2
        )} MXN (incluye comisión + IVA)
        \n¿Deseas continuar?`
      )
    ) {
      return;
    }

    setProcesandoPago(true);
    try {
      // Creamos sesión de pago
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

      // Guardamos la inscripción
      await registrarInscripcion({
        carreraId: carrera.id,
        carreraTitulo: carrera.titulo,
        perfilId: perfilSeleccionado,
        categoria: categoriaSeleccionada,
        sessionId,
      });

      // Leemos número asignado
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

      // Redirigimos
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

  // Agrega cálculo de edad y categorías permitidas:
const eventYear = carrera?.fecha ? new Date(carrera.fecha).getFullYear() : new Date().getFullYear();
const basisDate = carrera?.ageBasis === "endOfYear"
  ? new Date(eventYear, 11, 31)
  : carrera?.fecha
  ? new Date(carrera.fecha)
  : new Date();
const perfilData = perfiles.find((p) => p.id === perfilSeleccionado);
const perfilAge = perfilData ? computeAge(perfilData.birthDate, basisDate) : 0;

// Encuentra categoría válida por edad
const categoriasDisponibles = carrera?.distancias.flatMap((d) =>
  d.categorias
    .filter((cat) => perfilAge >= cat.minAge && perfilAge <= cat.maxAge)
    .map((cat) => ({ ...cat, distancia: d.distancia }))
) || [];

const categoriaElegida = categoriasDisponibles.find((c) => c.nombre === categoriaSeleccionada);
const precioSeleccionado = categoriaElegida?.price ?? 0;

  return (
  <div className="max-w-3xl mx-auto bg-white rounded-lg shadow overflow-hidden">
    {carrera?.bannerUrl && (
      <div
        className="h-56 bg-cover bg-center"
        style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
      />
    )}
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{carrera?.titulo}</h1>
      {carrera?.descripcion && <p className="text-gray-700">{carrera.descripcion}</p>}

      {/* Tabla de categorías ya existente */}

      <div className="p-4 bg-gray-100 rounded">
        <p className="font-medium">Edad en base a la convocatoria: {perfilAge} años</p>
        <p className="text-sm text-gray-600">
          Según {carrera?.ageBasis === "endOfYear"
            ? `corte al 31/12/${eventYear}`
            : `fecha del evento (${carrera?.fecha})`}
        </p>
        <p className="text-sm mt-2">
          Categorías disponibles: {categoriasDisponibles.map((c) => `${c.distancia} - ${c.nombre}`).join(", ") || "Ninguna"}
        </p>
      </div>

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
              onChange={(e) => setPerfilSeleccionado(e.target.value)}
            >
              {perfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno} (${computeAge(p.birthDate, basisDate)} años)`}
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
            onChange={(e) => setCategoriaSeleccionada(e.target.value)}
            disabled={!categoriasDisponibles.length}
          >
            <option value="">-- Selecciona categoría --</option>
            {categoriasDisponibles.map((cat) => (
              <option key={`${cat.distancia}-${cat.nombre}`} value={cat.nombre}>
                {`${cat.distancia} - ${cat.nombre}`}
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
          onClick={async () => {
            if (!perfilSeleccionado || !categoriaSeleccionada || !currentUser || !carrera) return;

            const dup = await getDocs(
              query(
                collection(db, "inscripciones"),
                where("carreraId", "==", carrera.id),
                where("perfilId", "==", perfilSeleccionado),
                where("perfilOwner", "==", currentUser.uid)
              )
            );
            if (!dup.empty) {
              setMensaje("Ya estás inscrito en esta carrera.");
              return;
            }

            const bruto = computeGross(precioSeleccionado);
            if (!window.confirm(`Vas a pagar $${bruto.toFixed(2)} MXN. ¿Deseas continuar?`)) return;

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
              const { url, sessionId } = await resp.json();

              await registrarInscripcion({
                carreraId: carrera.id,
                carreraTitulo: carrera.titulo,
                perfilId: perfilSeleccionado,
                categoria: categoriaSeleccionada,
                sessionId,
              });
              router.push("/mis-inscripciones");
              window.open(url, "_blank")?.focus();
            } catch (e: any) {
              setMensaje(e.message);
              setProcesandoPago(false);
            }
          }}
          disabled={!perfilSeleccionado || !categoriaSeleccionada || procesandoPago}
          className={`w-full py-3 rounded text-white transition ${
            perfilSeleccionado && categoriaSeleccionada
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {procesandoPago
            ? "Procesando…"
            : `Inscribirme y pagar $${computeGross(precioSeleccionado).toFixed(2)}`}
        </button>
      ) : (
        <div className="text-center">
          <Link href="/login" className="text-blue-600 underline">
            Inicia sesión para inscribirte
          </Link>
        </div>
      )}

      {mensaje && <p className="text-center text-red-600">{mensaje}</p>}
    </div>
  </div>
);
}
