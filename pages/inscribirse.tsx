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
  "w-full rounded-xl border border-dh-purple/15 bg-white px-3 py-2.5 text-dh-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";
const labelBase = "block text-sm font-semibold text-dh-ink mb-2";
const pill =
  "inline-flex items-center gap-2 rounded-full border border-dh-purple/10 bg-dh-soft px-3 py-1 text-xs font-semibold text-gray-700";

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
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
    <div className="min-h-screen bg-dh-soft">
      {/* Banner */}
      {carrera.bannerUrl ? (
        <div className="relative w-full h-72 md:h-80">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-dh-dark/80 via-dh-dark/55 to-transparent" />
        </div>
      ) : (
        <div className="relative w-full h-44 bg-gradient-to-r from-dh-purple to-dh-green">
          <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-transparent to-black" />
        </div>
      )}

      {/* Card principal */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className={`${cardBase} -mt-16 relative z-10 p-6 md:p-8 space-y-6`}>
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-dh-muted">
              {carrera.titulo}
            </h1>
            {carrera.descripcion && (
              <p className="text-gray-600 max-w-2xl mx-auto">{carrera.descripcion}</p>
            )}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <span className={pill}>
                <CalendarIcon className="w-4 h-4 text-dh-purple" />
                {fechaEvento}
              </span>
              {carrera.lugar && (
                <span className={pill}>
                  <MapPinIcon className="w-4 h-4 text-dh-green" />
                  {carrera.lugar}
                </span>
              )}
              {carrera.horaSalida && (
                <span className={pill}>
                  <TicketIcon className="w-4 h-4 text-gray-600" />
                  {carrera.horaSalida}
                </span>
              )}
            </div>

            {(carrera.kitFecha || carrera.kitLugar || carrera.kitHorario) && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-semibold text-dh-ink">Kit:</span>{" "}
                {carrera.kitFecha || "—"} {carrera.kitLugar || ""} {carrera.kitHorario || ""}
              </div>
            )}
          </div>

          {/* Rama pendiente */}
          {ramaPendiente && (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-700 mt-0.5" />
                <div className="text-sm">
                  <div className="font-bold text-yellow-900">Tu perfil no tiene Rama</div>
                  <div className="text-yellow-800">
                    Puedes ir a tu perfil a guardarla, o elegirla aquí solo para esta inscripción.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelBase}>Rama (solo esta inscripción)</label>
                  <select
                    className={selectBase}
                    value={ramaManual}
                    onChange={(e) => setRamaManual(e.target.value as any)}
                  >
                    <option value="">-- Selecciona --</option>
                    <option value="Femenil">Femenil</option>
                    <option value="Varonil">Varonil</option>
                  </select>
                </div>

                <button
                  onClick={() => router.push(`/perfil?edit=${encodeURIComponent(perfilId)}`)}
                  className="self-end px-4 py-2 rounded-xl bg-dh-purple text-white text-sm font-extrabold hover:opacity-95"
                >
                  Ir a Perfil
                </button>
              </div>
            </div>
          )}

          {/* Tabla de categorías */}
          <div className="overflow-auto rounded-2xl border border-dh-purple/10">
            <table className="w-full min-w-[760px] table-auto border-collapse">
              <thead className="bg-dh-soft">
                <tr className="text-left">
                  <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                    Distancia
                  </th>
                  <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                    Categoría
                  </th>
                  <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                    Edad
                  </th>
                  <th className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                    Precio
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {(distancias ?? []).map((d: any) =>
                  (d.categorias ?? []).map((cat: any) => (
                    <tr
                      key={`${d.distancia}-${cat.nombre}`}
                      className="border-t border-dh-purple/10 hover:bg-gray-50 transition"
                    >
                      <td className="p-3 text-dh-ink font-medium">{d.distancia}</td>
                      <td className="p-3 text-dh-ink">{cat.nombre}</td>
                      <td className="p-3 text-dh-ink">
                        {cat.minAge}-{cat.maxAge}
                      </td>
                      <td className="p-3 text-dh-ink">
                        <span className="font-semibold">${cat.price}</span>{" "}
                        <span className="text-gray-500">+ IVA</span>
                      </td>
                    </tr>
                  ))
                )}

                {!distancias?.length && (
                  <tr>
                    <td className="p-4 text-sm text-gray-500" colSpan={4}>
                      Esta carrera todavía no tiene distancias/categorías configuradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Snapshot preview */}
          {perfilSeleccionado && (
            <div className="rounded-2xl border border-dh-purple/10 bg-dh-soft p-4">
              <div className="flex items-start gap-3">
                <InformationCircleIcon className="w-6 h-6 text-dh-purple mt-0.5" />
                <div className="w-full space-y-1">
                  <div className="font-extrabold text-dh-ink text-sm">
                    Datos que se guardarán (snapshot)
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-semibold">Nombre:</span>{" "}
                    {fullName(
                      perfilSeleccionado.nombre,
                      perfilSeleccionado.apellidoPaterno,
                      perfilSeleccionado.apellidoMaterno
                    ) || "—"}
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-semibold">Email:</span> {perfilSeleccionado.email || "—"}
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-semibold">Cel:</span> {perfilSeleccionado.celular || "—"}
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-semibold">Rama:</span> {ramaFinal || "—"}
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-semibold">Ciudad/Estado/País:</span>{" "}
                    {[perfilSeleccionado.ciudad, perfilSeleccionado.estado, perfilSeleccionado.pais]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>

                  {!!distancia && (
                    <div className="text-xs text-gray-700 pt-1">
                      <span className="font-semibold">Edad calculada:</span> {edadPerfil} años
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {carreraFinalizada && (
  <div className="rounded-2xl border border-dh-purple/20 bg-dh-soft p-5 flex flex-col gap-4">
    <div className="text-center">
      <div className="text-lg font-extrabold text-dh-ink">
        🏁 Carrera finalizada
      </div>
      <p className="text-sm text-gray-600 mt-1">
        Esta carrera ya se llevó a cabo. Las inscripciones están cerradas.
      </p>
    </div>

    {hayResultados && (
      <a
        href={resultadosUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-dh-green text-dh-dark font-extrabold hover:opacity-95 transition"
      >
        🏁 Ver resultados oficiales
      </a>
    )}
  </div>
)}

          {/* Form */}
          <div className={`${cardBase} p-5 space-y-4`}>
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-dh-ink">Tu inscripción</div>
              <div className="text-xs text-gray-500">Completa perfil + distancia + categoría</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Perfil */}
              <div>
                <label className={labelBase}>
                  <span className="inline-flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-dh-green" />
                    Perfil
                  </span>
                </label>
                <select
                  className={selectBase}
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

              {/* Distancia */}
              <div>
                <label className={labelBase}>Distancia</label>
                <select
                  className={selectBase}
                  value={distancia}
                  onChange={(e) => setDistancia(e.target.value)}
                >
                  <option value="">-- Selecciona --</option>
                  {(distancias ?? []).map((d: any) => (
                    <option key={d.distancia} value={d.distancia}>
                      {d.distancia}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoría */}
              <div>
                <label className={labelBase}>Categoría</label>
                <select
                  className={`${selectBase} disabled:opacity-50`}
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
                {distancia && !categoriasPermitidas.length && (
                  <p className="text-xs text-gray-500 mt-2">
                    No hay categorías para tu edad en esta distancia.
                  </p>
                )}
              </div>
            </div>

            {/* CTA */}
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
  className={`w-full py-3 rounded-xl font-extrabold transition ${
    carreraFinalizada || !abiertas
      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
      : perfilId && distancia && categoria
      ? "bg-dh-green text-dh-dark hover:opacity-95"
      : "bg-gray-300 text-gray-600 cursor-not-allowed"
  }`}
>
  {carreraFinalizada
    ? "Carrera finalizada"
    : !abiertas
    ? "Inscripciones pausadas"
    : procesando
    ? "Procesando..."
    : ramaPendiente && !ramaManual
    ? "Selecciona Rama"
    : "Inscribirme y Pagar"}
</button>


            {!abiertas && (
              <p className="text-center text-red-700 text-sm font-semibold">{pausaMsg}</p>
            )}

            {mensaje && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {mensaje}
              </div>
            )}

            <p className="text-sm text-gray-600 text-center">
              ¿No tienes perfil?{" "}
              <Link href="/perfil" className="text-dh-purple underline font-semibold">
                Créalo aquí
              </Link>
            </p>
          </div>

          {/* mini footer status */}
          {user && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <CheckCircleIcon className="w-4 h-4 text-dh-green" />
              Sesión activa: <span className="font-semibold">{user.email}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
