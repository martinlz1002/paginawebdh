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

  const [userCreds, setUserCreds] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const [birthDate, setBirthDate] = useState<string>("");
  const [edad, setEdad] = useState<number>(0);
  const [distancia, setDistancia] = useState<string>("");
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
        setDistancias(d.distancias || []);
        setAgeBasis(d.ageBasis || "endOfYear");
      })
      .catch(() => setStep("expired"));
  }, [id]);

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

  useEffect(() => {
    if (!birthDate || !distancia || !race) return;
    const bd = new Date(birthDate);
    const basis = ageBasis === "endOfYear" ? new Date(new Date(race.fecha).getFullYear(), 11, 31) : new Date(race.fecha);
    let age = basis.getFullYear() - bd.getFullYear();
    const m = basis.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && basis.getDate() < bd.getDate())) age--;
    setEdad(age);
    const dist = distancias.find(d => d.distancia === distancia);
    if (!dist) return;
    setDispCats(dist.categorias.filter(c => age >= c.minAge && age <= c.maxAge));
    setCategoria("");
  }, [birthDate, distancia, race, ageBasis, distancias]);

  const handleSubmit = async () => {
    if (!tempUser) return;
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
      alert("Competidor registrado correctamente");
      setAvailable(av => av.filter(n => n !== numero));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (step === "expired") return <p className="p-6 text-center">Este enlace ha expirado.</p>;

  if (step === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm bg-white shadow-md p-6 rounded-md">
          <h2 className="text-xl font-bold mb-4 text-center text-purple-700">Acceso Temporal</h2>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <input className="w-full mb-2 p-2 border rounded" placeholder="Usuario" value={userCreds.username} onChange={e => setUserCreds(u => ({ ...u, username: e.target.value }))} />
          <input className="w-full mb-4 p-2 border rounded" type="password" placeholder="Contraseña" value={userCreds.password} onChange={e => setUserCreds(u => ({ ...u, password: e.target.value }))} />
          <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold" onClick={handleLogin}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <TempAuthGuard>
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <h2 className="text-xl font-semibold text-purple-700">Inscripción Manual</h2>
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <label className="block text-sm font-medium">Fecha de nacimiento</label>
        <input type="date" className="w-full p-2 border rounded" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
        <p className="text-sm">Edad calculada: {edad} años</p>

        <label className="block text-sm font-medium">Distancia</label>
        <select className="w-full p-2 border rounded" value={distancia} onChange={e => setDistancia(e.target.value)}>
          <option value="">-- Elige distancia --</option>
          {distancias.map(d => (
            <option key={d.distancia} value={d.distancia}>{d.distancia}</option>
          ))}
        </select>

        <label className="block text-sm font-medium">Categoría</label>
        <select className="w-full p-2 border rounded" value={categoria} onChange={e => setCategoria(e.target.value)} disabled={!dispCats.length}>
          <option value="">-- Elige categoría --</option>
          {dispCats.map(c => (
            <option key={c.nombre} value={c.nombre}>{c.nombre} ({c.minAge}–{c.maxAge} años)</option>
          ))}
        </select>

        <label className="block text-sm font-medium">Número</label>
        <select className="w-full p-2 border rounded" value={numero} onChange={e => setNumero(+e.target.value)}>
          <option value={0}>-- elige --</option>
          {available.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Datos del competidor */}
        {Object.entries(competidor).map(([field, value]) => (
          <div key={field}>
            <label className="block text-sm font-medium capitalize">{field === 'club' ? 'Club (opcional)' : field}</label>
            <input className="w-full p-2 border rounded" value={value} onChange={e => setCompetidor(c => ({ ...c, [field]: e.target.value }))} />
          </div>
        ))}

        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold disabled:bg-gray-400" onClick={handleSubmit} disabled={!birthDate || !categoria || numero === 0}>
          Registrar Competidor
        </button>
      </div>
    </TempAuthGuard>
  );
}
