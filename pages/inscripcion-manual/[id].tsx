import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import TempAuthGuard from "@/components/TempAuthGuard";
import { registrarInscripcionManual } from "@/lib/Inscripciones";

interface APIUser {
  id: string;
  carreraId: string;
  range: { start: number; end: number };
  username: string;
  expiresAt: string;
}

export default function ManualPage() {
  const { query } = useRouter();
  const id = Array.isArray(query.id) ? query.id[0] : query.id;

  const [step, setStep] = useState<"login" | "form" | "expired">("login");
  const [tempUser, setTempUser] = useState<APIUser | null>(null);
  const [user, setUser] = useState({ username: "", password: "" });
  const [available, setAvailable] = useState<number[]>([]);
  const [form, setForm] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    email: "",
    celular: "",
    ciudad: "",
    estado: "",
    pais: "",
    club: "",
    competitorNumber: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // 1️⃣ Cargo datos públicos de tempUser
  useEffect(() => {
    if (!id) return;
    fetch(`/api/get-tempusuario?id=${id}`)
      .then(r => {
        if (!r.ok) throw r;
        return r.json();
      })
      .then((u: APIUser) => setTempUser(u))
      .catch(() => setStep("expired"));
  }, [id]);

  // 2️⃣ Login local (comparamos contra tempUser.username/password en localStorage)
  const handleLogin = () => {
    if (!tempUser) return;
    const stored = localStorage.getItem("tempUser");
    if (!stored) {
      setError("Primero debes loguearte en /temp-login");
      return;
    }
    const u = JSON.parse(stored) as APIUser & { password: string };
    if (user.username === u.username && user.password === u.password) {
      // ✔️ cargo lista de disponibles
      fetch(`/api/temp-avail?id=${id}`)
        .then(r => r.json())
        .then(({ available }: { available: number[] }) => {
          setAvailable(available);
          setStep("form");
        })
        .catch(() => setError("No pude calcular disponibles"));
    } else {
      setError("Credenciales incorrectas");
    }
  };

  // 3️⃣ Envío del formulario
  const handleSubmit = async () => {
    if (!tempUser) return;
    try {
      await registrarInscripcionManual({
        carreraId: tempUser.carreraId,
        perfilNombre: form.nombre,
        perfilApPaterno: form.apellidoPaterno,
        perfilApMaterno: form.apellidoMaterno,
        email: form.email,
        celular: form.celular,
        ciudad: form.ciudad,
        estado: form.estado,
        pais: form.pais,
        club: form.club,
        competitorNumber: form.competitorNumber,
        paymentStatus: "manual",
      });
      alert("Competidor registrado correctamente");
      setAvailable(av => av.filter(n => n !== form.competitorNumber));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (step === "expired") {
    return <p className="p-6 text-center">Este enlace ha expirado.</p>;
  }

  if (step === "login") {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-xl mb-4">Login Inscripción Manual</h2>
        {error && <p className="text-red-600">{error}</p>}
        <input
          placeholder="Usuario"
          className="w-full mb-2 p-2 border"
          value={user.username}
          onChange={e => setUser(u => ({ ...u, username: e.target.value }))}
        />
        <input
          placeholder="Contraseña"
          type="password"
          className="w-full mb-4 p-2 border"
          value={user.password}
          onChange={e => setUser(u => ({ ...u, password: e.target.value }))}
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

  // ── FORM ──
  return (
    <TempAuthGuard>
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <h2 className="text-xl">Inscripción Manual</h2>
        <p>Competidores restantes: {available.length}</p>
        {error && <p className="text-red-600">{error}</p>}

        <label>Número</label>
        <select
          className="w-full p-2 border"
          value={form.competitorNumber}
          onChange={e =>
            setForm(f => ({ ...f, competitorNumber: +e.target.value }))
          }
        >
          <option value={0}>-- elige --</option>
          {available.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        {/* ... resto campos igual ... */}

        <button
          className="w-full bg-green-600 text-white py-2 rounded"
          onClick={handleSubmit}
        >
          Registrar Competidor
        </button>
      </div>
    </TempAuthGuard>
  );
}