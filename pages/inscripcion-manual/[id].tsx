import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import TempAuthGuard from "@/components/TempAuthGuard";
import { registrarInscripcionManual } from "@/lib/Inscripciones";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  const { id } = router.query as { id?: string };

  const [step, setStep] = useState<"login" | "form" | "expired">("login");
  const [tempUser, setTempUser] = useState<APIUser | null>(null);
  const [race, setRace] = useState<(CarreraData & { id: string }) | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ageBasis, setAgeBasis] = useState<"endOfYear" | "eventDate">("endOfYear");

  // Login temporal
  const [userCreds, setUserCreds] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [birthDate, setBirthDate] = useState<string>("");
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
    club: ""
  });

  // 1️⃣ Carga datos públicos
  useEffect(() => {
    if (!id) return;
    fetch(`/api/get-tempusuario?id=${id}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((u: APIUser) => {
        setTempUser(u);
        return getDoc(doc(db, "carreras", u.carreraId));
      })
      .then(csnap => {
        if (!csnap.exists()) throw new Error("Carrera no encontrada");
        const d = csnap.data() as any;
        setRace({ id: csnap.id, ...d });
        setCategorias(d.categorias || []);
        setAgeBasis(d.ageBasis || "endOfYear");
      })
      .catch(() => setStep("expired"));
  }, [id]);

  // 2️⃣ Login temporal
  const handleLogin = async () => {
    setError(null);
    try {
      const res = await fetch("/api/temp-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userCreds),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Credenciales inválidas");
      const u = data.user as APIUser;
      if (u.id !== id) throw new Error("Estas credenciales no pertenecen a este enlace");
      localStorage.setItem("tempUser", JSON.stringify({ ...u, password: userCreds.password }));
      setTempUser(u);

      const availRes = await fetch(`/api/temp-avail?id=${id}`);
      const availJson = await availRes.json();
      setAvailable(availJson.available as number[]);
      setStep("form");
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 3️⃣ Recalcula edad y categorías
  useEffect(() => {
    if (!birthDate || !race) return;
    const bd = new Date(birthDate);
    const basis =
      ageBasis === "endOfYear"
        ? new Date(new Date(race.fecha as any).getFullYear(), 11, 31)
        : new Date(race.fecha as any);
    let age = basis.getFullYear() - bd.getFullYear();
    const m = basis.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && basis.getDate() < bd.getDate())) age--;
    setEdad(age);
    setDispCats(categorias.filter(c => age >= c.minAge && age <= c.maxAge));
    setCategoria("");
  }, [birthDate, race, ageBasis, categorias]);

  // 4️⃣ Envía la inscripción manual
  const handleSubmit = async () => {
    if (!tempUser) return;
    try {
      await registrarInscripcionManual({
        carreraId:        tempUser.carreraId,
        perfilNombre:     competidor.nombre,
        perfilApPaterno:  competidor.apellidoPaterno,
        perfilApMaterno:  competidor.apellidoMaterno,
        birthDate:        new Date(birthDate),
        categoria,
        email:            competidor.email,
        celular:          competidor.celular,
        ciudad:           competidor.ciudad,
        estado:           competidor.estado,
        pais:             competidor.pais,
        club:             competidor.club,
        competitorNumber: numero,
      });
      alert("Competidor registrado correctamente");
      setAvailable(av => av.filter(n => n !== numero));
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Vistas según estado ──
  if (step === "expired") {
    return <p className="p-6 text-center">Este enlace ha expirado.</p>;
  }

  if (step === "login") {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-xl mb-4">Login Inscripción Manual</h2>
        {error && <p className="text-red-600">{error}</p>}
        <input
          className="w-full mb-2 p-2 border"
          placeholder="Usuario"
          value={userCreds.username}
          onChange={e => setUserCreds(u => ({ ...u, username: e.target.value }))}
        />
        <input
          className="w-full mb-4 p-2 border"
          type="password"
          placeholder="Contraseña"
          value={userCreds.password}
          onChange={e => setUserCreds(u => ({ ...u, password: e.target.value }))}
        />
        <button
          className="w-full bg-blue-600 text-white py-2 rounded"
          onClick={handleLogin}
        >
          Entrar
        </button>
      </div>
    );
  }

  return (
    <TempAuthGuard>
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <h2 className="text-xl">Inscripción Manual</h2>
        {error && <p className="text-red-600">{error}</p>}

        <label>Fecha de nacimiento</label>
        <input
          type="date"
          className="w-full p-2 border"
          value={birthDate}
          onChange={e => setBirthDate(e.target.value)}
        />
        <p>Edad calculada: {edad} años</p>

        <label>Categoría</label>
        <select
          className="w-full p-2 border"
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

        <label>Número</label>
        <select
          className="w-full p-2 border"
          value={numero}
          onChange={e => setNumero(+e.target.value)}
        >
          <option value={0}>-- elige --</option>
          {available.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Datos del competidor */}
        <label>Nombre</label>
        <input
          className="w-full p-2 border"
          value={competidor.nombre}
          onChange={e => setCompetidor(c => ({ ...c, nombre: e.target.value }))}
        />
        <label>Apellido Paterno</label>
        <input
          className="w-full p-2 border"
          value={competidor.apellidoPaterno}
          onChange={e => setCompetidor(c => ({ ...c, apellidoPaterno: e.target.value }))}
        />
        <label>Apellido Materno</label>
        <input
          className="w-full p-2 border"
          value={competidor.apellidoMaterno}
          onChange={e => setCompetidor(c => ({ ...c, apellidoMaterno: e.target.value }))}
        />

        <label>Email</label>
        <input
          type="email"
          className="w-full p-2 border"
          value={competidor.email}
          onChange={e => setCompetidor(c => ({ ...c, email: e.target.value }))}
        />
        <label>Celular</label>
        <input
          className="w-full p-2 border"
          value={competidor.celular}
          onChange={e => setCompetidor(c => ({ ...c, celular: e.target.value }))}
        />

        <label>Ciudad</label>
        <input
          className="w-full p-2 border"
          value={competidor.ciudad}
          onChange={e => setCompetidor(c => ({ ...c, ciudad: e.target.value }))}
        />
        <label>Estado</label>
        <input
          className="w-full p-2 border"
          value={competidor.estado}
          onChange={e => setCompetidor(c => ({ ...c, estado: e.target.value }))}
        />
        <label>País</label>
        <input
          className="w-full p-2 border"
          value={competidor.pais}
          onChange={e => setCompetidor(c => ({ ...c, pais: e.target.value }))}
        />
        <label>Club (opcional)</label>
        <input
          className="w-full p-2 border"
          value={competidor.club}
          onChange={e => setCompetidor(c => ({ ...c, club: e.target.value }))}
        />

        <button
          className="w-full bg-green-600 text-white py-2 rounded"
          onClick={handleSubmit}
          disabled={!birthDate || !categoria || numero === 0}
        >
          Registrar Competidor
        </button>
      </div>
    </TempAuthGuard>
  );
}