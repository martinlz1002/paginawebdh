import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { registrarInscripcionManual } from "@/lib/Inscripciones";
import type { CarreraData } from "@/types/carrera";
import {
  LockClosedIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  HashtagIcon,
  TrophyIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

interface APIUser {
  id: string;
  carreraId: string;
  range: { start: number; end: number };
  username: string;
  expiresAt: string;
  expiresAtMs: number;
}

interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
}

interface DistanciaConCategorias {
  distancia: string;
  categorias: Categoria[];
}

type Step = "checking" | "login" | "form" | "list" | "expired";

function fullName(nombre: string, paterno: string, materno: string) {
  return `${(nombre || "").trim()} ${(paterno || "").trim()} ${(materno || "").trim()}`
    .replace(/\s+/g, " ")
    .trim();
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

const inputBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-10 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";

const selectBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-10 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";
const cardBase =
  "bg-white rounded-2xl border border-dh-purple/10 shadow-dh";

export default function ManualPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [step, setStep] = useState<Step>("checking");

  const [inscripciones, setInscripciones] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [linkUser, setLinkUser] = useState<APIUser | null>(null);
  const [race, setRace] = useState<(CarreraData & { id: string }) | null>(null);
  const [distancias, setDistancias] = useState<DistanciaConCategorias[]>([]);
  const [ageBasis, setAgeBasis] = useState<"endOfYear" | "eventDate">("endOfYear");

  const [userCreds, setUserCreds] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [birthDate, setBirthDate] = useState("");
  const [edad, setEdad] = useState(0);
  const [distancia, setDistancia] = useState("");
  const [dispCats, setDispCats] = useState<Categoria[]>([]);
  const [categoria, setCategoria] = useState("");
  const [available, setAvailable] = useState<number[]>([]);
  const [numero, setNumero] = useState(0);

  const [competidor, setCompetidor] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    rama: "",
    email: "",
    celular: "",
    ciudad: "",
    estado: "",
    pais: "",
    club: "",
  });

  const loadInscripciones = async () => {
  if (!linkUser) return;

  setLoadingList(true);

  try {
    const res = await fetch(
      `/api/get-inscripciones-by-carrera?carreraId=${linkUser.carreraId}`
    );

    const data = await res.json();

    setInscripciones(data || []);
  } catch (e) {
    console.error(e);
  } finally {
    setLoadingList(false);
  }
};

  const [loginLoading, setLoginLoading] = useState(false);

  const timeoutRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  // ✅ Forzar login SIEMPRE al entrar a un link
  useEffect(() => {
    if (!id) return;
    try {
      localStorage.removeItem("tempUser");
    } catch {}
  }, [id]);

  // 1) Validar link (API) + cargar carrera.
  useEffect(() => {
    if (!id) return;
    cancelledRef.current = false;

    const clearExpiryTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const run = async () => {
      setError(null);
      setStep("checking");
      clearExpiryTimer();

      try {
        const res = await fetch(`/api/get-tempusuario?id=${id}&t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) {
          if (res.status === 410) {
            setStep("expired");
            return;
          }
          const msg = await res.text().catch(() => "");
          throw new Error(`Error validando enlace (${res.status}). ${msg}`);
        }

        const u = (await res.json()) as APIUser;

        if (!Number.isFinite(u.expiresAtMs)) throw new Error("expiresAtMs inválido.");
        if (u.expiresAtMs <= Date.now()) {
          setStep("expired");
          return;
        }

        if (cancelledRef.current) return;
        setLinkUser(u);

        timeoutRef.current = window.setTimeout(() => setStep("expired"), u.expiresAtMs - Date.now());

        const rc = await fetch(`/api/get-carrera?id=${u.carreraId}&t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        if (!rc.ok) {
          const msg = await rc.text().catch(() => "");
          throw new Error(`No se pudo cargar la carrera (${rc.status}). ${msg}`);
        }

        const d = (await rc.json()) as any;
        if (cancelledRef.current) return;

        setRace({ id: d.id, ...d });
        setDistancias(Array.isArray(d.distancias) ? d.distancias : []);
        setAgeBasis(d.ageBasis === "eventDate" ? "eventDate" : "endOfYear");

        setStep("login");
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Error cargando enlace temporal.");
        setStep("login");
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [id]);

  // 2) Login
  const handleLogin = async () => {
    setError(null);
    if (!linkUser || !id) return;

    setLoginLoading(true);

    try {
      const res = await fetch(`/api/temp-login?t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(userCreds),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Credenciales inválidas");

      const u = data.user as APIUser;

      if (u.id !== id) throw new Error("Estas credenciales no pertenecen a este enlace");
      if (!Number.isFinite(u.expiresAtMs) || u.expiresAtMs <= Date.now()) {
        setStep("expired");
        return;
      }

      localStorage.setItem("tempUser", JSON.stringify({ ...u, password: userCreds.password }));

      const availRes = await fetch(`/api/temp-avail?id=${id}&t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!availRes.ok) {
        if (availRes.status === 410) {
          setStep("expired");
          return;
        }
        const msg = await availRes.text().catch(() => "");
        throw new Error(`Error obteniendo disponibilidad (${availRes.status}). ${msg}`);
      }

      const availJson = await availRes.json();
      setAvailable((availJson.available || []) as number[]);
      setStep("form");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // ✅ Edad + categorías (con parse seguro)
  useEffect(() => {
    if (!birthDate || !distancia || !race) return;

    const bd = parseISODateYYYYMMDD(birthDate);

    const raceFecha =
      (race as any)?.fecha?.toDate ? (race as any).fecha.toDate() : new Date((race as any).fecha);

    const basis = ageBasis === "endOfYear" ? new Date(raceFecha.getFullYear(), 11, 31) : raceFecha;

    let age = basis.getFullYear() - bd.getFullYear();
    const m = basis.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && basis.getDate() < bd.getDate())) age--;
    setEdad(age);

    const dist = distancias.find((d) => d.distancia === distancia);
    if (!dist) {
      setDispCats([]);
      setCategoria("");
      return;
    }

    setDispCats(dist.categorias.filter((c) => age >= c.minAge && age <= c.maxAge));
    setCategoria("");
  }, [birthDate, distancia, race, ageBasis, distancias]);

  const handleSubmit = async () => {
    setError(null);

    if (!linkUser) return;

    if (Date.now() > linkUser.expiresAtMs) {
      setStep("expired");
      return;
    }

    if (!birthDate || !distancia || !categoria || numero === 0) {
      setError("Por favor, completa todos los campos obligatorios.");
      return;
    }

    const campos = [
      "nombre",
      "apellidoPaterno",
      "apellidoMaterno",
      "rama",
      "email",
      "celular",
      "ciudad",
      "estado",
      "pais",
    ];
    for (const campo of campos) {
      if (!(competidor as any)[campo]) {
        setError(`El campo ${campo} es obligatorio.`);
        return;
      }
    }

    if (!race?.titulo) {
      setError("No se pudo obtener el nombre del evento (carreraTitulo).");
      return;
    }

    const nombre = competidor.nombre.trim();
    const paterno = competidor.apellidoPaterno.trim();
    const materno = competidor.apellidoMaterno.trim();
    const nombres = fullName(nombre, paterno, materno);

    try {
      await registrarInscripcionManual({
        carreraId: linkUser.carreraId,
        carreraTitulo: race.titulo,
        manualAdminId: linkUser.id,

        competitorNumber: numero,

        nombre,
        paterno,
        materno,
        nombres,

        rama: competidor.rama,

        // ✅ sigue siendo el campo base en tu schema manual
        ruta: distancia,

        // ✅ extra opcional (si luego lo agregas al lib, ya lo traes aquí)
        // distancia,

        categoria,

        email: competidor.email,
        celular: competidor.celular,
        ciudad: competidor.ciudad,
        estado: competidor.estado,
        pais: competidor.pais,
        club: competidor.club,

        // ✅ parse seguro
        fechaNacimiento: parseISODateYYYYMMDD(birthDate),
      });

      setAvailable((av) => av.filter((n) => n !== numero));
      setNumero(0);
      setCategoria("");
      setDistancia("");
      setBirthDate("");
      setEdad(0);
      setDispCats([]);
      setCompetidor({
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        rama: "",
        email: "",
        celular: "",
        ciudad: "",
        estado: "",
        pais: "",
        club: "",
      });

      setSuccessMessage("✓ Competidor registrado correctamente.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // UI (lo demás igual)
  if (step === "checking")
    return (
      <div className="min-h-screen bg-dh-soft flex items-center justify-center p-6">
        <div className={`${cardBase} p-6 w-full max-w-md text-center`}>
          <p className="text-dh-ink font-medium">Cargando…</p>
          <p className="text-gray-500 text-sm mt-2">Validando enlace temporal 🧾</p>
        </div>
      </div>
    );

  if (step === "expired")
    return (
      <div className="min-h-screen bg-dh-soft flex items-center justify-center p-6">
        <div className={`${cardBase} p-6 w-full max-w-md text-center`}>
          <p className="text-xl font-bold text-dh-purple">Enlace expirado</p>
          <p className="text-gray-600 mt-2">
            Este enlace ya caducó. Pide al admin que genere uno nuevo.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-dh-purple px-4 py-2.5 text-white font-semibold hover:opacity-95 transition"
          >
            Volver al inicio <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    );

  if (step === "login") {
    return (
      <div className="min-h-screen bg-dh-soft flex items-center justify-center p-6">
        <div className={`${cardBase} w-full max-w-sm p-6`}>
          <div className="text-center space-y-2 mb-5">
            <h2 className="text-2xl font-extrabold text-dh-purple">Acceso Temporal</h2>
            {race?.titulo ? (
              <p className="text-sm text-gray-600">
                Evento: <span className="font-semibold text-dh-ink">{race.titulo}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-500">Ingresa tus credenciales para continuar.</p>
            )}
          </div>

          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Usuario"
                value={userCreds.username}
                disabled={loginLoading}
                onChange={(e) => setUserCreds((u) => ({ ...u, username: e.target.value }))}
              />
            </div>

            <div className="relative">
              <LockClosedIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                type="password"
                placeholder="Contraseña"
                value={userCreds.password}
                disabled={loginLoading}
                onChange={(e) => setUserCreds((u) => ({ ...u, password: e.target.value }))}
              />
            </div>

            <button
              className="w-full rounded-xl bg-dh-purple text-white py-2.5 font-semibold hover:opacity-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleLogin}
              disabled={!linkUser || loginLoading}
            >
              {loginLoading ? "Verificando…" : "Entrar"}
            </button>

            {loginLoading && (
              <p className="text-xs text-gray-500 text-center">
                Un segundo… validando credenciales 🧾
              </p>
            )}

            {linkUser?.range && (
              <div className="mt-3 rounded-xl bg-dh-soft border border-dh-purple/10 p-3 text-sm text-gray-700">
                <p className="font-semibold text-dh-ink">Rango asignado</p>
                <p>
                  Números:{" "}
                  <span className="font-semibold text-dh-purple">
                    {linkUser.range.start}–{linkUser.range.end}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === "list") {
  return (
    <div className="min-h-screen bg-dh-soft py-10 px-4">
      <div className="max-w-5xl mx-auto">

        <h2 className="text-2xl font-bold text-dh-purple mb-6">
          Inscripciones
        </h2>

        <button
          onClick={() => setStep("form")}
          className="mb-4 text-sm text-dh-purple underline"
        >
          ← Volver a registrar
        </button>

        {loadingList ? (
          <p>Cargando...</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Ruta</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">Pago</th>
                </tr>
              </thead>

              <tbody>
                {inscripciones.map((i, idx) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-3">{i.competitorNumber}</td>
                    <td className="p-3">{i.nombres}</td>
                    <td className="p-3">{i.ruta}</td>
                    <td className="p-3">{i.categoria}</td>
                    <td className="p-3">
                      {i.paymentStatus === "paid" && "Pagado"}
                      {i.paymentStatus === "manual" && "Manual"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

  // form (resto igual)
  return (
    <div className="min-h-screen bg-dh-soft py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className={`${cardBase} p-6`}>
          <h2 className="text-2xl font-extrabold text-dh-purple">Inscripción Manual</h2>

          {race?.titulo && (
            <p className="text-sm text-gray-600 mt-1">
              Evento: <span className="font-semibold text-dh-ink">{race.titulo}</span>
            </p>
          )}

          {successMessage && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              ✅ {successMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <button
  onClick={() => {
    loadInscripciones();
    setStep("list");
  }}
  className="w-full rounded-xl border border-dh-purple text-dh-purple py-2 font-semibold hover:bg-dh-purple/10 transition"
>
  Ver inscritos 👁️
</button>

        <div className={`${cardBase} p-6 space-y-5`}>
          {/* Fecha de nacimiento */}
          <div>
            <label className="block text-sm font-semibold text-dh-ink mb-2">
              Fecha de nacimiento
            </label>
            <div className="relative">
              <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                className={inputBase}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Edad calculada: <span className="font-semibold text-dh-ink">{edad}</span> años
              <span className="text-gray-400"> • </span>
              Base:{" "}
              <span className="font-medium">
                {ageBasis === "endOfYear" ? "Fin de año" : "Fecha del evento"}
              </span>
            </p>
          </div>

          {/* Distancia / Categoría / Número */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-dh-ink mb-2">Distancia</label>
              <div className="relative">
                <TrophyIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  className={selectBase}
                  value={distancia}
                  onChange={(e) => setDistancia(e.target.value)}
                >
                  <option value="">-- Elige --</option>
                  {distancias.map((d) => (
                    <option key={d.distancia} value={d.distancia}>
                      {d.distancia}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-dh-ink mb-2">Categoría</label>
              <div className="relative">
                <TrophyIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  className={selectBase}
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  disabled={!dispCats.length}
                >
                  <option value="">-- Elige --</option>
                  {dispCats.map((c) => (
                    <option key={c.nombre} value={c.nombre}>
                      {c.nombre} ({c.minAge}–{c.maxAge})
                    </option>
                  ))}
                </select>
              </div>
              {!dispCats.length && distancia && birthDate && (
                <p className="text-xs text-gray-500 mt-2">
                  No hay categorías para esa edad en esta distancia.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-dh-ink mb-2">Número</label>
              <div className="relative">
                <HashtagIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  className={selectBase}
                  value={numero}
                  onChange={(e) => setNumero(+e.target.value)}
                >
                  <option value={0}>-- Elige --</option>
                  {available.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Disponibles: <span className="font-semibold">{available.length}</span>
              </p>
            </div>
          </div>

          {/* Rama */}
          <div>
            <label className="block text-sm font-semibold text-dh-ink mb-2">Rama</label>
            <div className="relative">
              <TrophyIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                className={selectBase}
                value={competidor.rama}
                onChange={(e) => setCompetidor((c) => ({ ...c, rama: e.target.value }))}
              >
                <option value="">-- Elige --</option>
                <option value="Femenil">Femenil</option>
                <option value="Varonil">Varonil</option>
              </select>
            </div>
          </div>

          {/* Datos del competidor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Nombre"
                value={competidor.nombre}
                onChange={(e) => setCompetidor((c) => ({ ...c, nombre: e.target.value }))}
              />
            </div>

            <div className="relative">
              <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Apellido paterno"
                value={competidor.apellidoPaterno}
                onChange={(e) => setCompetidor((c) => ({ ...c, apellidoPaterno: e.target.value }))}
              />
            </div>

            <div className="relative">
              <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Apellido materno"
                value={competidor.apellidoMaterno}
                onChange={(e) => setCompetidor((c) => ({ ...c, apellidoMaterno: e.target.value }))}
              />
            </div>

            <div className="relative">
              <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Email"
                value={competidor.email}
                onChange={(e) => setCompetidor((c) => ({ ...c, email: e.target.value }))}
              />
            </div>

            <div className="relative">
              <PhoneIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Celular"
                value={competidor.celular}
                onChange={(e) => setCompetidor((c) => ({ ...c, celular: e.target.value }))}
              />
            </div>

            <div className="relative">
              <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Ciudad"
                value={competidor.ciudad}
                onChange={(e) => setCompetidor((c) => ({ ...c, ciudad: e.target.value }))}
              />
            </div>

            <div className="relative">
              <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Estado"
                value={competidor.estado}
                onChange={(e) => setCompetidor((c) => ({ ...c, estado: e.target.value }))}
              />
            </div>

            <div className="relative">
              <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="País"
                value={competidor.pais}
                onChange={(e) => setCompetidor((c) => ({ ...c, pais: e.target.value }))}
              />
            </div>

            <div className="relative md:col-span-2">
              <TrophyIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={inputBase}
                placeholder="Club (opcional)"
                value={competidor.club}
                onChange={(e) => setCompetidor((c) => ({ ...c, club: e.target.value }))}
              />
            </div>
          </div>

          <button
            className="w-full rounded-xl bg-dh-green text-dh-dark py-3 font-extrabold hover:opacity-95 transition"
            onClick={handleSubmit}
          >
            Registrar Competidor
          </button>

          <p className="text-xs text-gray-500 text-center">
            Tip: si el enlace expira, te va a mandar a “Enlace expirado” automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
