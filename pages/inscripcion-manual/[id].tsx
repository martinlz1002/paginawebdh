import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import TempAuthGuard from "@/components/TempAuthGuard";
import { registrarInscripcionManual } from "@/lib/Inscripciones";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore";
import type { CarreraData } from "@/types/carrera";

interface APIUser {
  id: string;
  carreraId: string;
  range: { start: number; end: number };
  username: string;
  expiresAt: string;
}
interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
}

export default function ManualPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [step, setStep] = useState<"loading" | "form" | "expired">("loading");
  const [tempUser, setTempUser] = useState<APIUser | null>(null);
  const [race, setRace] = useState<(CarreraData & { id: string }) | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ageBasis, setAgeBasis] = useState<"endOfYear" | "eventDate">("endOfYear");

  // formulario
  const [birthDate, setBirthDate] = useState<string>(""); // yyyy‑MM‑dd
  const [edad, setEdad] = useState<number>(0);
  const [dispCats, setDispCats] = useState<Categoria[]>([]);
  const [categoria, setCategoria] = useState<string>("");
  const [available, setAvailable] = useState<number[]>([]);
  const [numero, setNumero] = useState<number>(0);
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

  // ── 1️⃣ Carga pública de tempUser + carrera ──
  useEffect(() => {
    if (!id) return;
    fetch(`/api/get-tempusuario?id=${id}`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((u: APIUser) => {
        setTempUser(u);
        return getDoc(doc(db, "carreras", u.carreraId));
      })
      .then(csnap => {
        if (!csnap.exists()) throw new Error();
        const d = csnap.data() as any;
        setRace({ id: csnap.id, ...d });
        setCategorias(d.categorias || []);
        setAgeBasis(d.ageBasis || "endOfYear");
        // calcular disponibles
        return fetch(`/api/temp-avail?id=${id}`);
      })
      .then(r => r.json())
      .then(({ available }: { available: number[] }) => {
        setAvailable(available);
        setStep("form");
      })
      .catch(() => setStep("expired"));
  }, [id]);

  // ── 2️⃣ Calcular edad y categorías al cambiar birthDate ──
  useEffect(() => {
    if (!birthDate || !race) return;
    const bd = new Date(birthDate);
    const basis = ageBasis === "endOfYear"
      ? new Date(new Date(race.fecha as any).getFullYear(), 11, 31)
      : new Date(race.fecha as any);
    let a = basis.getFullYear() - bd.getFullYear();
    const m = basis.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && basis.getDate() < bd.getDate())) a--;
    setEdad(a);
    setDispCats(categorias.filter(c => a >= c.minAge && a <= c.maxAge));
    setCategoria("");
  }, [birthDate, race, ageBasis, categorias]);

  // ── 3️⃣ Enviar inscripción manual ──
  const handleSubmit = async () => {
    setError(null);
    if (!race || !tempUser) return;
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
        paymentStatus: "manual",
      });
      alert("Competidor registrado correctamente");
      setAvailable(av => av.filter(n => n !== numero));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (step === "loading") {
    return <TempAuthGuard><p className="p-6 text-center">Validando enlace…</p></TempAuthGuard>;
  }
  if (step === "expired") {
    return <TempAuthGuard><p className="p-6 text-center text-red-600">Este enlace ha expirado o no es válido.</p></TempAuthGuard>;
  }

  // ── FORMULARIO ──
  return (
    <TempAuthGuard>
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <h2 className="text-xl font-semibold">Inscripción Manual</h2>
        {error && <p className="text-red-600">{error}</p>}

        {/* 1. Fecha de nacimiento */}
        <div>
          <label className="block font-medium">Fecha de nacimiento</label>
          <input
            type="date"
            className="w-full p-2 border rounded"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
          />
          <p className="mt-1 text-sm">Edad calculada: <strong>{edad}</strong> años</p>
        </div>

        {/* 2. Categoría filtrada */}
        <div>
          <label className="block font-medium">Categoría</label>
          <select
            className="w-full p-2 border rounded disabled:opacity-50"
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            disabled={!dispCats.length}
          >
            <option value="">-- Elige categoría --</option>
            {dispCats.map(c => (
              <option key={c.nombre} value={c.nombre}>
                {c.nombre} ({c.minAge}–{c.maxAge} años)
              </option>
            ))}
          </select>
        </div>

        {/* 3. Número disponible */}
        <div>
          <label className="block font-medium">Número de competidor</label>
          <select
            className="w-full p-2 border rounded"
            value={numero}
            onChange={e => setNumero(+e.target.value)}
          >
            <option value={0}>-- Elige número --</option>
            {available.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* 4. Datos del competidor */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block font-medium">Nombre</label>
            <input
              className="w-full p-2 border rounded"
              value={competidor.nombre}
              onChange={e => setCompetidor(c => ({ ...c, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="block font-medium">Apellido Paterno</label>
            <input
              className="w-full p-2 border rounded"
              value={competidor.apellidoPaterno}
              onChange={e => setCompetidor(c => ({ ...c, apellidoPaterno: e.target.value }))}
            />
          </div>
          <div>
            <label className="block font-medium">Apellido Materno</label>
            <input
              className="w-full p-2 border rounded"
              value={competidor.apellidoMaterno}
              onChange={e => setCompetidor(c => ({ ...c, apellidoMaterno: e.target.value }))}
            />
          </div>
          <div>
            <label className="block font-medium">Email</label>
            <input
              type="email"
              className="w-full p-2 border rounded"
              value={competidor.email}
              onChange={e => setCompetidor(c => ({ ...c, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block font-medium">Celular</label>
            <input
              className="w-full p-2 border rounded"
              value={competidor.celular}
              onChange={e => setCompetidor(c => ({ ...c, celular: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-medium">Ciudad</label>
              <input
                className="w-full p-2 border rounded"
                value={competidor.ciudad}
                onChange={e => setCompetidor(c => ({ ...c, ciudad: e.target.value }))}
              />
            </div>
            <div>
              <label className="block font-medium">Estado</label>
              <input
                className="w-full p-2 border rounded"
                value={competidor.estado}
                onChange={e => setCompetidor(c => ({ ...c, estado: e.target.value }))}
              />
            </div>
            <div>
              <label className="block font-medium">País</label>
              <input
                className="w-full p-2 border rounded"
                value={competidor.pais}
                onChange={e => setCompetidor(c => ({ ...c, pais: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block font-medium">Club (opcional)</label>
            <input
              className="w-full p-2 border rounded"
              value={competidor.club}
              onChange={e => setCompetidor(c => ({ ...c, club: e.target.value }))}
            />
          </div>
        </div>

        <button
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={!(birthDate && categoria && numero > 0)}
        >
          Registrar Competidor
        </button>
      </div>
    </TempAuthGuard>
  );
}