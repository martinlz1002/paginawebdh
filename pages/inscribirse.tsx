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
import {
  UserIcon,
  CalendarIcon,
  MapPinIcon,
  TicketIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
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
  return "" as any; // si viene raro, mejor vacío para forzar corrección
}

// UI tokens DH
const cardBase = "bg-white rounded-2xl border border-dh-purple/10 shadow-dh";
const selectBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-3 py-2.5 text-dh-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-purple/40";
const labelBase = "block text-sm font-semibold text-dh-ink mb-2";
const pill =
  "inline-flex items-center gap-2 rounded-full border border-dh-purple/10 bg-dh-soft px-3 py-1 text-xs font-semibold text-gray-700";

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId, slug } = router.query;
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [carrera, setCarrera] = useState<CarreraFull | null>(null);

  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilId, setPerfilId] = useState("");

  const [distancia, setDistancia] = useState("");
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<Categoria[]>([]);
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
    // pendiente SOLO si el perfil está seleccionado y no trae rama
    return !!perfilSeleccionado && !ramaPerfil;
  }, [perfilSeleccionado, ramaPerfil]);

  // ✅ distancias seguras para toda la UI (evita undefined)
  const distancias = useMemo(() => {
    return (carrera?.distancias ?? []) as any[];
  }, [carrera]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  // Carga carrera
  useEffect(() => {
  if (!carreraId && !slug) return;

  (async () => {
    try {
      // 🔹 1. Intentar con carreraId (flujo actual)
      if (carreraId) {
        const snap = await getDoc(doc(db, "carreras", carreraId as string));

        if (snap.exists()) {
          setCarrera({ id: snap.id, ...(snap.data() as any) } as CarreraFull);
          return;
        }
      }

      // 🔹 2. Intentar con slug
      if (slug) {
        const q = query(
          collection(db, "carreras"),
          where("slug", "==", slug)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setCarrera({ id: docData.id, ...(docData.data() as any) } as CarreraFull);
          return;
        }
      }

      // 💀 Nada encontrado
      setMensaje("Carrera no encontrada");
    } catch (e: any) {
      setMensaje(e?.message || "Error cargando carrera");
    }
  })();
}, [carreraId, slug]);

  // Carga perfiles
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
        const subSnap = await getDocs(collection(db, "usuarios", user.uid, "perfiles"));
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

    const distObj = (distancias ?? []).find((d: any) => d.distancia === distancia);
    if (!distObj) {
      setCategoriasPermitidas([]);
      setCategoria("");
      return;
    }

    const cats = (distObj.categorias ?? []).filter(
      (c: any) => edad >= c.minAge && edad <= c.maxAge
    );

    setCategoriasPermitidas(cats);
    setCategoria("");
  }, [carrera, perfilId, distancia, perfiles, distancias]);

  // Si cambias de perfil, resetea rama manual
  useEffect(() => {
    setRamaManual("");
    setMensaje("");
  }, [perfilId]);

  const handlePagar = async () => {
    if (carreraFinalizada) {
  return setMensaje("Esta carrera ya finalizó. No es posible inscribirse.");
}
  setMensaje("");

  if (!user) return setMensaje("Inicia sesión para inscribirte.");
  if (!carrera || !perfilId || !distancia || !categoria) {
    return setMensaje("Completa todos los campos.");
  }

  const perfil = perfiles.find((p) => p.id === perfilId);
  if (!perfil) return setMensaje("Perfil inválido.");

  // ✅ ahora sí: si el perfil no trae rama, usamos la manual
  if (!ramaFinal) return setMensaje("Selecciona tu Rama para continuar.");

  // Validación snapshot mínimo
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

    // ✅ precio neto (server calcula total final)
    const neto =
      categoriasPermitidas.find((c) => c.nombre === categoria)?.price ?? 0;
    if (!neto) return setMensaje("No se pudo determinar el precio de la categoría.");

    if (
      !confirm(
        `Vas a inscribirte en:\n- ${carrera.titulo}\n- ${distancia} / ${categoria}\n\nPrecio neto: $${neto.toFixed(
          2
        )} MXN (+ comisión e IVA en el cobro final).\n¿Continuar?`
      )
    ) {
      return;
    }

    // ✅ crea sesión Stripe (server calcula unit_amount)
    const res = await fetch("/api/checkout_sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carreraId: carrera.id,
        perfilId,
        categoria,
        distancia,
      }),
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

    const { url, sessionId } = data;
    if (!url || !sessionId) throw new Error("Stripe no devolvió url/sessionId");

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

      rama: ramaFinal,

      pais: perfil.pais,
      estado: perfil.estado,
      ciudad: perfil.ciudad,
      celular: perfil.celular,
      club: perfil.club,

      fechaNacimiento: perfil.birthDate,
      email: perfil.email,
    });

    // ✅ IMPORTANTÍSIMO:
    // ❌ NO popup, NO _blank
    // ✅ redirige en la MISMA pestaña (no lo bloquea el navegador)
    window.location.href = url;

    // (Opcional) Si quieres que siempre pase por /pago para fallback:
    // router.push(`/pago?inscripcionId=${encodeURIComponent(INSCRIPCION_ID_AQUI)}`)
    // pero para eso tendrías que devolver inscripcionId desde registrarInscripcion.
  } catch (err: any) {
    setMensaje("Error al iniciar pago: " + (err?.message || "desconocido"));
  } finally {
    setProcesando(false);
  }
};


  if (!carrera) {
    return (
      <div className="min-h-screen bg-dh-soft px-4 py-12">
        <div className="max-w-xl mx-auto text-center">
          <div className={`${cardBase} p-6`}>
            <p className="text-dh-ink font-semibold">{mensaje || "Cargando…"}</p>
            <p className="text-sm text-gray-500 mt-2">
              Si esto tarda mucho, revisa tu conexión o que exista el carreraId.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const abiertas = (carrera as any)?.inscripcionesAbiertas !== false;
  const pausaMsg =
    (carrera as any)?.inscripcionesMensaje || "Inscripciones pausadas temporalmente.";

  const fechaEventoDate = parseISODateYYYYMMDD((carrera as any).fecha);
const fechaEvento = fechaEventoDate.toLocaleDateString("es-MX");

  const today = new Date();
today.setHours(0, 0, 0, 0);

const carreraFinalizada = fechaEventoDate < today;

const resultadosUrl = (carrera as any)?.resultados?.url;
const resultadosPublicado = (carrera as any)?.resultados?.publicado === true;
const hayResultados = carreraFinalizada && resultadosPublicado && !!resultadosUrl;

  return (
  <div className="min-h-screen bg-dh-bg">
    {/* Banner */}
    {carrera.bannerUrl ? (
      <div className="relative w-full h-80">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>
    ) : (
      <div className="h-56 bg-gradient-to-r from-dh-purple to-dh-purpleDark" />
    )}

    <div className="max-w-6xl mx-auto px-4 -mt-20 relative z-10 pb-16">
      <div className="card p-8 space-y-10">

        {/* HEADER */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold text-dh-ink">
            {carrera.titulo}
          </h1>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-dh-muted">
            <span>{fechaEvento}</span>
            {carrera.lugar && <span>{carrera.lugar}</span>}
            {carrera.horaSalida && <span>{carrera.horaSalida}</span>}
          </div>
        </div>

        {/* STEPS */}
        <div className="grid lg:grid-cols-3 gap-10">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-8">

            {/* PERFIL */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-dh-ink">
                1. Selecciona Perfil
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                {perfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPerfilId(p.id)}
                    className={`p-5 rounded-2xl border transition text-left ${
                      perfilId === p.id
                        ? "border-dh-purple bg-dh-purple/5"
                        : "border-dh-border hover:border-dh-purple/40"
                    }`}
                  >
                    <div className="font-bold">
                      {p.nombre} {p.apellidoPaterno}
                    </div>
                    <div className="text-sm text-dh-muted">
                      {p.email}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* DISTANCIA */}
            {perfilId && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-dh-ink">
                  2. Selecciona Distancia
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  {distancias.map((d: any) => (
                    <button
                      key={d.distancia}
                      onClick={() => setDistancia(d.distancia)}
                      className={`p-6 rounded-2xl border transition ${
                        distancia === d.distancia
                          ? "border-dh-purple bg-dh-purple/5"
                          : "border-dh-border hover:border-dh-purple/40"
                      }`}
                    >
                      <div className="text-lg font-bold">
                        {d.distancia}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CATEGORIA */}
            {distancia && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-dh-ink">
                  3. Selecciona Categoría
                </h2>

                <div className="grid md:grid-cols-2 gap-4">
                  {categoriasPermitidas.map((cat) => (
                    <button
                      key={cat.nombre}
                      onClick={() => setCategoria(cat.nombre)}
                      className={`p-6 rounded-2xl border transition text-left ${
                        categoria === cat.nombre
                          ? "border-dh-purple bg-dh-purple/5"
                          : "border-dh-border hover:border-dh-purple/40"
                      }`}
                    >
                      <div className="font-bold">{cat.nombre}</div>
                      <div className="text-sm text-dh-muted">
                        {cat.minAge}-{cat.maxAge} años
                      </div>
                      <div className="text-xl font-extrabold mt-2 text-dh-purple">
                        ${cat.price}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT RESUMEN */}
          <div className="space-y-6">

            <div className="card p-6 space-y-4">
              <h3 className="font-extrabold text-dh-ink">
                Resumen
              </h3>

              <div className="text-sm space-y-2 text-dh-muted">
                <div>
                  <span className="font-semibold text-dh-ink">Perfil:</span>{" "}
                  {perfilSeleccionado
                    ? `${perfilSeleccionado.nombre} ${perfilSeleccionado.apellidoPaterno}`
                    : "—"}
                </div>

                <div>
                  <span className="font-semibold text-dh-ink">Distancia:</span>{" "}
                  {distancia || "—"}
                </div>

                <div>
                  <span className="font-semibold text-dh-ink">Categoría:</span>{" "}
                  {categoria || "—"}
                </div>

                {categoria && (
                  <div className="pt-2 text-lg font-extrabold text-dh-purple">
                    $
                    {categoriasPermitidas.find(
                      (c) => c.nombre === categoria
                    )?.price ?? 0}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handlePagar}
              disabled={
                carreraFinalizada ||
                !abiertas ||
                !perfilId ||
                !distancia ||
                !categoria ||
                procesando ||
                (ramaPendiente && !ramaManual)
              }
              className={`w-full py-4 rounded-2xl font-extrabold transition ${
                perfilId && distancia && categoria
                  ? "bg-dh-purple text-dh-dark hover:opacity-95"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              }`}
            >
              {procesando ? "Procesando..." : "Inscribirme y Pagar"}
            </button>

            {mensaje && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {mensaje}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
