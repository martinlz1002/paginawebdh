import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { registrarInscripcionManual } from "@/lib/Inscripciones";
import type { CarreraData } from "@/types/carrera";

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

type Step = "checking" | "login" | "form" | "expired";

function readTempUserFromLS(): any | null {
  try {
    const raw = localStorage.getItem("tempUser");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getExpMs(u: any): number {
  const expMs =
    typeof u?.expiresAtMs === "number"
      ? u.expiresAtMs
      : typeof u?.expiresAt === "string"
        ? new Date(u.expiresAt).getTime()
        : NaN;
  return Number.isFinite(expMs) ? expMs : NaN;
}

export default function ManualPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [step, setStep] = useState<Step>("checking");

  const [linkUser, setLinkUser] = useState<APIUser | null>(null); // lo que dice la API del link
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
    email: "",
    celular: "",
    ciudad: "",
    estado: "",
    pais: "",
    club: "",
  });

  const timeoutRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  // 🔥 1) Validar link (API) + cargar carrera. Luego decidir si mostrar login o form según localStorage.
  useEffect(() => {
    if (!id) return;
    cancelledRef.current = false;

    const run = async () => {
      setError(null);
      setStep("checking");

      try {
        // 1) Validar link tempusuario
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

        // programar expiración UNA SOLA VEZ
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => setStep("expired"), u.expiresAtMs - Date.now());

        // 2) Cargar carrera por API (admin)
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

        // 3) Decidir: ¿ya está logueado este mismo link?
        const ls = readTempUserFromLS();
        const lsExp = getExpMs(ls);

        const sameLink = ls?.id === id;
        const lsValid = sameLink && Number.isFinite(lsExp) && lsExp > Date.now();

        if (lsValid) {
          // ya hay sesión válida para ESTE link: cargar disponibilidad y mostrar form
          const availRes = await fetch(`/api/temp-avail?id=${id}&t=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          });

          if (!availRes.ok) {
            if (availRes.status === 410) {
              localStorage.removeItem("tempUser");
              setStep("expired");
              return;
            }
            const msg = await availRes.text().catch(() => "");
            throw new Error(`Error obteniendo disponibilidad (${availRes.status}). ${msg}`);
          }

          const availJson = await availRes.json();
          setAvailable((availJson.available || []) as number[]);
          setStep("form");
        } else {
          // si hay tempUser viejo de otro link o expirado, lo limpiamos para evitar bypass
          if (ls && (!sameLink || !Number.isFinite(lsExp) || lsExp <= Date.now())) {
            localStorage.removeItem("tempUser");
          }
          setStep("login");
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Error cargando enlace temporal.");
        // ojo: no lo marques expired por cualquier cosa
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

  // 🔐 2) Login (guarda en localStorage y luego carga disponibilidad + entra a form)
  const handleLogin = async () => {
    setError(null);
    if (!linkUser || !id) return;

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

      // 1) Deben pertenecer a ESTE link
      if (u.id !== id) throw new Error("Estas credenciales no pertenecen a este enlace");

      // 2) No debe estar expirado
      if (!Number.isFinite(u.expiresAtMs) || u.expiresAtMs <= Date.now()) {
        setStep("expired");
        return;
      }

      // Guardar sesión temporal (si quieres NO guardar password, bórralo aquí)
      localStorage.setItem("tempUser", JSON.stringify({ ...u, password: userCreds.password }));

      // cargar disponibilidad
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
    }
  };

  // 🧮 3) Edad + categorías
  useEffect(() => {
    if (!birthDate || !distancia || !race) return;

    const bd = new Date(birthDate);

    const raceFecha =
      (race as any)?.fecha?.toDate ? (race as any).fecha.toDate() : new Date((race as any).fecha);

    const basis =
      ageBasis === "endOfYear" ? new Date(raceFecha.getFullYear(), 11, 31) : raceFecha;

    let age = basis.getFullYear() - bd.getFullYear();
    const m = basis.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && basis.getDate() < bd.getDate())) age--;
    setEdad(age);

    const dist = distancias.find((d) => d.distancia === distancia);
    if (!dist) return;

    setDispCats(dist.categorias.filter((c) => age >= c.minAge && age <= c.maxAge));
    setCategoria("");
  }, [birthDate, distancia, race, ageBasis, distancias]);

  const handleSubmit = async () => {
    if (!linkUser) return;

    if (Date.now() > linkUser.expiresAtMs) {
      setStep("expired");
      return;
    }

    if (!birthDate || !distancia || !categoria || numero === 0) {
      setError("Por favor, completa todos los campos obligatorios.");
      return;
    }

    const campos = ["nombre", "apellidoPaterno", "apellidoMaterno", "email", "celular", "ciudad", "estado", "pais"];
    for (const campo of campos) {
      if (!(competidor as any)[campo]) {
        setError(`El campo ${campo} es obligatorio.`);
        return;
      }
    }

    try {
      await registrarInscripcionManual({
        carreraId: linkUser.carreraId,
        perfilNombre: competidor.nombre,
        perfilApPaterno: competidor.apellidoPaterno,
        perfilApMaterno: competidor.apellidoMaterno,
        birthDate: new Date(birthDate),
        categoria,
        email: competidor.email,
        celular: competidor.celular,
        ciudad: competidor.ciudad,
        estado: competidor.estado,
        pais: competidor.pais,
        club: competidor.club,
        competitorNumber: numero,
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

  // UI
  if (step === "checking") return <p className="p-6 text-center">Cargando…</p>;

  if (step === "expired") return <p className="p-6 text-center">Este enlace ha expirado.</p>;

  if (step === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm bg-white shadow-md p-6 rounded-md">
          <h2 className="text-xl font-bold mb-4 text-center text-purple-700">Acceso Temporal</h2>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <input
            className="w-full mb-2 p-2 border rounded"
            placeholder="Usuario"
            value={userCreds.username}
            onChange={(e) => setUserCreds((u) => ({ ...u, username: e.target.value }))}
          />
          <input
            className="w-full mb-4 p-2 border rounded"
            type="password"
            placeholder="Contraseña"
            value={userCreds.password}
            onChange={(e) => setUserCreds((u) => ({ ...u, password: e.target.value }))}
          />
          <button
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold"
            onClick={handleLogin}
            disabled={!linkUser}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  // step === "form"
  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h2 className="text-xl font-semibold text-purple-700">Inscripción Manual</h2>

      {successMessage && (
        <p className="flex items-center gap-2 text-green-600 text-sm font-medium">
          <span className="text-lg">✅</span>
          {successMessage}
        </p>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <label className="block text-sm font-medium">Fecha de nacimiento</label>
      <input
        type="date"
        className="w-full p-2 border rounded"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
      />
      <p className="text-sm">Edad calculada: {edad} años</p>

      <label className="block text-sm font-medium">Distancia</label>
      <select
        className="w-full p-2 border rounded"
        value={distancia}
        onChange={(e) => setDistancia(e.target.value)}
      >
        <option value="">-- Elige distancia --</option>
        {distancias.map((d) => (
          <option key={d.distancia} value={d.distancia}>
            {d.distancia}
          </option>
        ))}
      </select>

      <label className="block text-sm font-medium">Categoría</label>
      <select
        className="w-full p-2 border rounded"
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        disabled={!dispCats.length}
      >
        <option value="">-- Elige categoría --</option>
        {dispCats.map((c) => (
          <option key={c.nombre} value={c.nombre}>
            {c.nombre} ({c.minAge}–{c.maxAge} años)
          </option>
        ))}
      </select>

      <label className="block text-sm font-medium">Número</label>
      <select
        className="w-full p-2 border rounded"
        value={numero}
        onChange={(e) => setNumero(+e.target.value)}
      >
        <option value={0}>-- elige --</option>
        {available.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      {Object.entries(competidor).map(([field, value]) => (
        <div key={field}>
          <label className="block text-sm font-medium capitalize">
            {field === "club" ? "Club (opcional)" : field}
          </label>
          <input
            className="w-full p-2 border rounded"
            value={value}
            onChange={(e) => setCompetidor((c) => ({ ...c, [field]: e.target.value }))}
          />
        </div>
      ))}

      <button
        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold"
        onClick={handleSubmit}
      >
        Registrar Competidor
      </button>
    </div>
  );
}