import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import TempAuthGuard from "@/components/TempAuthGuard";
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

export default function ManualPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [step, setStep] = useState<"login" | "form" | "expired">("login");
  const [tempUser, setTempUser] = useState<APIUser | null>(null);
  const [race, setRace] = useState<(CarreraData & { id: string }) | null>(null);

  const [distancias, setDistancias] = useState<DistanciaConCategorias[]>([]);
  const [ageBasis, setAgeBasis] = useState<"endOfYear" | "eventDate">("endOfYear");

  const [birthDate, setBirthDate] = useState("");
  const [edad, setEdad] = useState(0);
  const [distancia, setDistancia] = useState("");
  const [categoria, setCategoria] = useState("");
  const [dispCats, setDispCats] = useState<Categoria[]>([]);
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

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);

  // 🔹 Cargar enlace temporal + carrera (SIN JSON EN UI)
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const load = async () => {
      try {
        // limpiar posibles restos de otro link
        const stored = localStorage.getItem("tempUser");
        if (stored) {
          const u = JSON.parse(stored);
          if (u?.id && u.id !== id) localStorage.removeItem("tempUser");
        }

        const res = await fetch(`/api/get-tempusuario?id=${id}&t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) {
          if (res.status === 410) {
            setStep("expired");
            return;
          }
          throw new Error("No se pudo validar el enlace");
        }

        const u: APIUser = await res.json();
        const msLeft = u.expiresAtMs - Date.now();

        if (msLeft <= 0) {
          setStep("expired");
          return;
        }

        if (cancelled) return;

        setTempUser(u);

        timeoutRef.current = window.setTimeout(
          () => setStep("expired"),
          msLeft
        );

        const raceRes = await fetch(`/api/get-carrera?id=${u.carreraId}&t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!raceRes.ok) throw new Error("Carrera no encontrada");

        const raceData = await raceRes.json();
        if (cancelled) return;

        setRace(raceData);
        setDistancias(raceData.distancias || []);
        setAgeBasis(raceData.ageBasis || "endOfYear");

        setStep("login");
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Error cargando enlace");
      }
    };

    load();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [id]);

  // 🔹 Cálculo de edad y categorías
  useEffect(() => {
    if (!birthDate || !distancia || !race) return;

    const bd = new Date(birthDate);
    const basis =
      ageBasis === "endOfYear"
        ? new Date(new Date(race.fecha).getFullYear(), 11, 31)
        : new Date(race.fecha);

    let age = basis.getFullYear() - bd.getFullYear();
    const m = basis.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && basis.getDate() < bd.getDate())) age--;

    setEdad(age);

    const d = distancias.find(x => x.distancia === distancia);
    if (!d) return;

    setDispCats(d.categorias.filter(c => age >= c.minAge && age <= c.maxAge));
    setCategoria("");
  }, [birthDate, distancia, race, ageBasis, distancias]);

  const handleSubmit = async () => {
    if (!tempUser) return;

    if (Date.now() > tempUser.expiresAtMs) {
      setStep("expired");
      return;
    }

    if (!birthDate || !distancia || !categoria || !numero) {
      setError("Completa todos los campos obligatorios");
      return;
    }

    try {
      await registrarInscripcionManual({
        carreraId: tempUser.carreraId,
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

      setAvailable(a => a.filter(n => n !== numero));
      setNumero(0);
      setSuccess("Competidor registrado correctamente");
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (step === "expired") {
    return <p className="p-6 text-center text-red-600">Este enlace ha expirado.</p>;
  }

  if (step === "login") {
    return (
      <TempAuthGuard>
        <div className="max-w-lg mx-auto p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-700">
            Inscripción Manual
          </h2>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">✅ {success}</p>}

          <label>Fecha de nacimiento</label>
          <input type="date" className="w-full p-2 border rounded" value={birthDate}
            onChange={e => setBirthDate(e.target.value)} />

          <p>Edad: {edad}</p>

          <label>Distancia</label>
          <select className="w-full p-2 border rounded"
            value={distancia} onChange={e => setDistancia(e.target.value)}>
            <option value="">-- elegir --</option>
            {distancias.map(d => (
              <option key={d.distancia} value={d.distancia}>{d.distancia}</option>
            ))}
          </select>

          <label>Categoría</label>
          <select className="w-full p-2 border rounded"
            value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">-- elegir --</option>
            {dispCats.map(c => (
              <option key={c.nombre} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>

          <label>Número</label>
          <select className="w-full p-2 border rounded"
            value={numero} onChange={e => setNumero(+e.target.value)}>
            <option value={0}>-- elegir --</option>
            {available.map(n => <option key={n} value={n}>{n}</option>)}
          </select>

          {Object.entries(competidor).map(([k, v]) => (
            <input key={k} className="w-full p-2 border rounded"
              placeholder={k} value={v}
              onChange={e => setCompetidor(c => ({ ...c, [k]: e.target.value }))} />
          ))}

          <button onClick={handleSubmit}
            className="w-full bg-purple-600 text-white py-2 rounded">
            Registrar
          </button>
        </div>
      </TempAuthGuard>
    );
  }

  return null;
}