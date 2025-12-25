import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
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
import { UserIcon } from "@heroicons/react/24/outline";
import type { Carrera as CarreraFull } from "@/types/carrera";

interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
}

interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  birthDate: Date;

  email: string;
  celular: string;
  ciudad: string;
  estado: string;
  pais: string;
  club: string;

  rama: string; // "Femenil" | "Varonil" | ""
}

function computeAge(birthDate: Date, basisDate: Date): number {
  let age = basisDate.getFullYear() - birthDate.getFullYear();
  const m = basisDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && basisDate.getDate() < birthDate.getDate())) age--;
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

function safeDateFromAny(v: any): Date {
  if (!v) return new Date("2000-01-01T00:00:00");
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date("2000-01-01T00:00:00") : d;
}

// ✅ parse seguro para "YYYY-MM-DD" (evita desfase por timezone)
function parseISODateYYYYMMDD(iso: any): Date {
  if (!iso || typeof iso !== "string") return new Date("2000-01-01T00:00:00");
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date("2000-01-01T00:00:00") : d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  return new Date(y, mo, day);
}

function fullName(nombre: string, paterno: string, materno: string) {
  return `${(nombre || "").trim()} ${(paterno || "").trim()} ${(materno || "").trim()}`
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRama(v: any): "Femenil" | "Varonil" | "" {
  const raw = (v ?? "").toString().trim();
  if (!raw) return "";
  const low = raw.toLowerCase();
  if (low === "f" || low === "femenil" || low === "mujer" || low === "female")
    return "Femenil";
  if (low === "m" || low === "varonil" || low === "hombre" || low === "male")
    return "Varonil";
  return raw as any;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [carrera, setCarrera] = useState<CarreraFull | null>(null);

  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilId, setPerfilId] = useState("");

  const [distancia, setDistancia] = useState("");
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<Categoria[]>(
    []
  );
  const [categoria, setCategoria] = useState("");

  const [edadPerfil, setEdadPerfil] = useState(0);
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  // ✅ Rama fallback si el perfil no trae
  const [ramaManual, setRamaManual] = useState<"Femenil" | "Varonil" | "">("");

  const perfilSeleccionado = useMemo(
    () => perfiles.find((p) => p.id === perfilId) || null,
    [perfiles, perfilId]
  );

  const ramaPerfil = useMemo(
    () => normalizeRama(perfilSeleccionado?.rama),
    [perfilSeleccionado]
  );

  const ramaFinal = useMemo(() => {
    if (ramaPerfil) return ramaPerfil;
    return ramaManual;
  }, [ramaPerfil, ramaManual]);

  const ramaPendiente = useMemo(() => {
    // pendiente SOLO si el perfil no trae rama (no nos interesa lo que el user seleccione manual aquí)
    return !!perfilSeleccionado && !ramaPerfil;
  }, [perfilSeleccionado, ramaPerfil]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  // Carga carrera
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "carreras", carreraId as string));
        if (snap.exists()) {
          setCarrera({ id: snap.id, ...(snap.data() as any) } as CarreraFull);
        } else {
          setMensaje("Carrera no encontrada");
        }
      } catch (e: any) {
        setMensaje(e?.message || "Error cargando carrera");
      }
    })();
  }, [carreraId]);

  // Carga perfiles (snapshot completo)
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const lista: Perfil[] = [];

        // perfil principal
        const udoc = await getDoc(doc(db, "usuarios", user.uid));
        if (udoc.exists()) {
          const d: any = udoc.data();
          const bd = safeDateFromAny(d.fechaNacimiento ?? d.birthDate);

          lista.push({
            id: user.uid,
            nombre: d.nombre || "",
            apellidoPaterno: d.apPaterno || d.apellidoPaterno || "",
            apellidoMaterno: d.apMaterno || d.apellidoMaterno || "",
            birthDate: bd,

            email: d.email || user.email || "",
            celular: d.celular || "",
            ciudad: d.ciudad || "",
            estado: d.estado || "",
            pais: d.pais || "México",
            club: d.club || "",
            rama: d.rama || d.sexo || "",
          });
        }

        // subperfiles
        const subSnap = await getDocs(
          collection(db, "usuarios", user.uid, "perfiles")
        );
        subSnap.forEach((d) => {
          const p: any = d.data();
          const bd = safeDateFromAny(p.fechaNacimiento ?? p.birthDate);

          lista.push({
            id: d.id,
            nombre: p.nombre || "",
            apellidoPaterno: p.apPaterno || p.apellidoPaterno || "",
            apellidoMaterno: p.apMaterno || p.apellidoMaterno || "",
            birthDate: bd,

            email: p.email || user.email || "",
            celular: p.celular || "",
            ciudad: p.ciudad || "",
            estado: p.estado || "",
            pais: p.pais || "México",
            club: p.club || "",
            rama: p.rama || p.sexo || "",
          });
        });

        setPerfiles(lista);
        if (lista.length) setPerfilId((prev) => prev || lista[0].id);
      } catch (e: any) {
        setMensaje(e?.message || "Error cargando perfiles");
      }
    })();
  }, [user]);

  // Calcula edad y categorías disponibles
  useEffect(() => {
    if (!carrera || !perfilId || !distancia) return;

    const perfil = perfiles.find((p) => p.id === perfilId);
    if (!perfil) return;

    const raceDate = parseISODateYYYYMMDD((carrera as any).fecha);
    const basisDate =
      carrera.ageBasis === "endOfYear"
        ? new Date(raceDate.getFullYear(), 11, 31)
        : raceDate;

    const edad = computeAge(perfil.birthDate, basisDate);
    setEdadPerfil(edad);

    const distObj = carrera.distancias.find((d) => d.distancia === distancia);
    if (!distObj) {
      setCategoriasPermitidas([]);
      setCategoria("");
      return;
    }

    const permitidas = distObj.categorias.filter(
      (c) => edad >= c.minAge && edad <= c.maxAge
    );

    setCategoriasPermitidas(permitidas);
    setCategoria("");
  }, [carrera, perfilId, distancia, perfiles]);

  // Si cambias de perfil, resetea rama manual (para no “arrastrar”)
  useEffect(() => {
    setRamaManual("");
    setMensaje(""); // limpia banners viejos al cambiar perfil
  }, [perfilId]);

  const handlePagar = async () => {
    setMensaje("");

    if (!user) {
      setMensaje("Inicia sesión para inscribirte.");
      return;
    }
    if (!carrera || !perfilId || !distancia || !categoria) {
      setMensaje("Completa todos los campos.");
      return;
    }

    const perfil = perfiles.find((p) => p.id === perfilId);
    if (!perfil) {
      setMensaje("Perfil inválido.");
      return;
    }

    // ✅ Mensaje específico que pediste
    if (!ramaPerfil) {
      setMensaje("Tu perfil tiene Rama pendiente");
      return;
    }

    // Validación snapshot mínimo (para Excel)
    const nombreCompleto = fullName(
      perfil.nombre,
      perfil.apellidoPaterno,
      perfil.apellidoMaterno
    );
    if (!nombreCompleto) return setMensaje("Tu perfil no tiene nombre completo.");
    if (!perfil.email) return setMensaje("Tu perfil no tiene email.");
    if (!perfil.celular) return setMensaje("Tu perfil no tiene celular.");
    if (!perfil.ciudad || !perfil.estado || !perfil.pais) {
      return setMensaje("Tu perfil debe tener ciudad/estado/país.");
    }

    setProcesando(true);

    try {
      // ✅ evita duplicados por owner + perfil
      const dup = await getDocs(
        query(
          collection(db, "inscripciones"),
          where("carreraId", "==", carrera.id),
          where("perfilOwner", "==", user.uid),
          where("perfilId", "==", perfilId)
        )
      );
      if (!dup.empty) {
        setMensaje("Ya estás inscrito en esta carrera con ese perfil.");
        return;
      }

      const price =
        categoriasPermitidas.find((c) => c.nombre === categoria)?.price ?? 0;
      const bruto = computeGross(price);

      if (
        !confirm(
          `Vas a pagar $${bruto.toFixed(2)} MXN (comisión+IVA).\n¿Continuar?`
        )
      )
        return;

      // ✅ crea sesión Stripe
      const res = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carreraId: carrera.id,
          perfilId,
          categoria,
          price: bruto,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { url, sessionId } = await res.json();

      // ✅ guarda inscripción con snapshot completo
      await registrarInscripcion({
        carreraId: carrera.id,
        carreraTitulo: carrera.titulo,
        perfilId,

        categoria,
        distancia,
        ruta: distancia,

        sessionId,

        nombre: perfil.nombre,
        paterno: perfil.apellidoPaterno,
        materno: perfil.apellidoMaterno,
        nombres: nombreCompleto,

        rama: ramaPerfil, // ✅ siempre viene del perfil ya completado

        pais: perfil.pais,
        estado: perfil.estado,
        ciudad: perfil.ciudad,
        celular: perfil.celular,
        club: perfil.club,

        fechaNacimiento: perfil.birthDate,
        email: perfil.email,
      });

      window.open(url, "_blank")?.focus();
      router.push("/mis-inscripciones");
    } catch (err: any) {
      setMensaje("Error al iniciar pago: " + (err?.message || "desconocido"));
    } finally {
      setProcesando(false);
    }
  };

  if (!carrera) {
    return <p className="text-center mt-10">{mensaje || "Cargando…"}</p>;
  }

  const abiertas = (carrera as any)?.inscripcionesAbiertas !== false;
const pausaMsg =
  (carrera as any)?.inscripcionesMensaje ||
  "Inscripciones pausadas temporalmente.";

  return (
    <div>
      {carrera.bannerUrl && (
        <div
          className="w-full h-64 bg-cover bg-center"
          style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
        />
      )}

      <div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-lg -mt-16 relative z-10 space-y-6">
        <h1 className="text-3xl font-extrabold text-center text-green-800">
          {carrera.titulo}
        </h1>

        {carrera.descripcion && (
          <p className="text-gray-600 text-center">{carrera.descripcion}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <strong>Fecha:</strong>{" "}
            {parseISODateYYYYMMDD((carrera as any).fecha).toLocaleDateString(
              "es-MX"
            )}
          </div>
          <div>
            <strong>Lugar:</strong> {carrera.lugar}
          </div>
          <div>
            <strong>Hora:</strong> {carrera.horaSalida}
          </div>
          {(carrera.kitFecha || carrera.kitLugar || carrera.kitHorario) && (
            <div>
              <strong>Kit:</strong> {carrera.kitFecha} {carrera.kitLugar}{" "}
              {carrera.kitHorario}
            </div>
          )}
        </div>

        {/* ✅ Banner Rama pendiente */}
        {ramaPendiente && (
          <div className="border border-yellow-300 bg-yellow-50 text-yellow-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm font-medium">
              Tu perfil tiene Rama pendiente
              <span className="block text-xs font-normal text-yellow-800 mt-1">
                Completa Rama en tu perfil para poder inscribirte.
              </span>
            </div>
            <button
  onClick={() => router.push(`/perfil?edit=${encodeURIComponent(perfilId)}`)}
  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
>
  Ir a Perfil
</button>
          </div>
        )}

        <table className="w-full table-auto border text-gray-700">
          <thead className="bg-green-50">
            <tr>
              <th className="border px-3 py-1">Distancia</th>
              <th className="border px-3 py-1">Categoría</th>
              <th className="border px-3 py-1">Edad</th>
              <th className="border px-3 py-1">Precio</th>
            </tr>
          </thead>
          <tbody>
            {carrera.distancias.map((d) =>
              d.categorias.map((cat) => (
                <tr key={`${d.distancia}-${cat.nombre}`}>
                  <td className="border px-3 py-1">{d.distancia}</td>
                  <td className="border px-3 py-1">{cat.nombre}</td>
                  <td className="border px-3 py-1">
                    {cat.minAge}-{cat.maxAge}
                  </td>
                  <td className="border px-3 py-1">${cat.price} + IVA</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Preview snapshot */}
        {perfilSeleccionado && (
          <div className="text-xs text-gray-500 bg-gray-50 border rounded p-3 space-y-1">
            <div className="font-semibold text-gray-700">
              Datos que se guardarán (snapshot)
            </div>
            <div>
              <strong>Nombre:</strong>{" "}
              {fullName(
                perfilSeleccionado.nombre,
                perfilSeleccionado.apellidoPaterno,
                perfilSeleccionado.apellidoMaterno
              ) || "—"}
            </div>
            <div>
              <strong>Email:</strong> {perfilSeleccionado.email || "—"}
            </div>
            <div>
              <strong>Cel:</strong> {perfilSeleccionado.celular || "—"}
            </div>
            <div>
              <strong>Rama:</strong> {ramaPerfil || "—"}
            </div>
            <div>
              <strong>Ciudad/Estado/País:</strong>{" "}
              {[
                perfilSeleccionado.ciudad,
                perfilSeleccionado.estado,
                perfilSeleccionado.pais,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
          </div>
        )}

        {/* Formulario */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center space-x-1">
              <UserIcon className="w-5 h-5 text-green-600" />
              <span>Perfil</span>
            </label>
            <select
              className="w-full border p-2 rounded"
              value={perfilId}
              onChange={(e) => setPerfilId(e.target.value)}
            >
              {perfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.apellidoPaterno}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Distancia</label>
            <select
              className="w-full border p-2 rounded"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
            >
              <option value="">-- Selecciona --</option>
              {carrera.distancias.map((d) => (
                <option key={d.distancia} value={d.distancia}>
                  {d.distancia}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Categoría</label>
            <select
              className="w-full border p-2 rounded disabled:opacity-50"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              disabled={!categoriasPermitidas.length}
            >
              <option value="">-- Selecciona --</option>
              {categoriasPermitidas.map((c) => (
                <option key={c.nombre} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        

        <button
  onClick={handlePagar}
  disabled={!abiertas || !perfilId || !distancia || !categoria || procesando}
  className={`w-full py-3 text-white font-medium rounded-lg ${
    abiertas && perfilId && distancia && categoria
      ? "bg-green-600 hover:bg-green-700"
      : "bg-gray-400 cursor-not-allowed"
  }`}
>
  {!abiertas ? "Inscripciones pausadas" : procesando ? "Procesando..." : "Inscribirme y Pagar"}
</button>

{!abiertas && (
  <p className="text-center text-red-600 text-sm">{pausaMsg}</p>
)}

        {mensaje && <p className="text-center text-red-600">{mensaje}</p>}

        <p className="text-sm text-gray-500 text-center">
          ¿No tienes perfil?{" "}
          <Link href="/perfil" className="text-green-600 underline">
            Créalo aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
