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
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [step, setStep] = useState<"login" | "form" | "expired">("login");
  const [tempUser, setTempUser] = useState<APIUser | null>(null);
  const [user, setUser] = useState({ username: "", password: "" });
  const [available, setAvailable] = useState<number[]>([]);
  const [form, setForm] = useState({
    competitorNumber: 0,
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

  // 1️⃣ Al montar, cargo los datos públicos del tempUser
  useEffect(() => {
    if (!id) return;
    fetch(`/api/get-tempusuario?id=${encodeURIComponent(id)}`)
      .then(async res => {
        if (!res.ok) throw new Error("No encontrado o expirado");
        return res.json();
      })
      .then((u: APIUser) => setTempUser(u))
      .catch(() => setStep("expired"));
  }, [id]);

  // 2️⃣ Login local: comparamos credenciales guardadas en localStorage
  const handleLogin = () => {
    if (!tempUser) return;
    const stored = localStorage.getItem("tempUser");
    if (!stored) {
      setError("Primero debes loguearte en /temp-login");
      return;
    }
    const u = JSON.parse(stored) as APIUser & { password: string };
    if (user.username === u.username && user.password === u.password) {
      // obtener lista de números disponibles
      fetch(`/api/temp-avail?id=${encodeURIComponent(id!)}`)
        .then(async res => {
          if (!res.ok) throw new Error("No pude calcular disponibles");
          return res.json();
        })
        .then(({ available }: { available: number[] }) => {
          setAvailable(available);
          setStep("form");
        })
        .catch(err => setError(err.message));
    } else {
      setError("Credenciales incorrectas");
    }
  };

  // 3️⃣ Envío del formulario
  const handleSubmit = async () => {
    if (!tempUser) return;
    setError(null);
    try {
      const resp = await fetch("/api/registrar-inscripcion-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carreraId: tempUser.carreraId,
          competitorNumber: form.competitorNumber,
          perfilNombre: form.nombre,
          perfilApPaterno: form.apellidoPaterno,
          perfilApMaterno: form.apellidoMaterno,
          email: form.email,
          celular: form.celular,
          ciudad: form.ciudad,
          estado: form.estado,
          pais: form.pais,
          club: form.club,
          paymentStatus: "manual",
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Error al registrar");
      }
      alert("Competidor registrado correctamente");
      // actualizo disponibles
      setAvailable(av => av.filter(n => n !== form.competitorNumber));
    } catch (e: any) {
      setError(e.message);
    }
  };

  // — Render por paso —
  if (step === "expired") {
    return <p className="p-6 text-center">Este enlace ha expirado.</p>;
  }

  if (step === "login") {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-xl mb-4">Login Inscripción Manual</h2>
        {error && <p className="text-red-600 mb-2">{error}</p>}
        <input
          className="w-full mb-2 p-2 border"
          placeholder="Usuario"
          value={user.username}
          onChange={e => setUser(u => ({ ...u, username: e.target.value }))}
        />
        <input
          className="w-full mb-4 p-2 border"
          placeholder="Contraseña"
          type="password"
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

  // step === "form"
  return (
    <TempAuthGuard>
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <h2 className="text-xl">Inscripción Manual</h2>
        <p>Competidores restantes: {available.length}</p>
        {error && <p className="text-red-600">{error}</p>}

        {/* Nº Competidor */}
        <label className="block font-medium">Número</label>
        <select
          className="w-full p-2 border rounded"
          value={form.competitorNumber}
          onChange={e =>
            setForm(f => ({ ...f, competitorNumber: +e.target.value }))
          }
        >
          <option value={0}>-- elige --</option>
          {available.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Datos personales */}
        <label className="block font-medium">Nombre</label>
        <input
          className="w-full p-2 border rounded"
          value={form.nombre}
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
        />
        <label className="block font-medium">Apellido Paterno</label>
        <input
          className="w-full p-2 border rounded"
          value={form.apellidoPaterno}
          onChange={e =>
            setForm(f => ({ ...f, apellidoPaterno: e.target.value }))
          }
        />
        <label className="block font-medium">Apellido Materno</label>
        <input
          className="w-full p-2 border rounded"
          value={form.apellidoMaterno}
          onChange={e =>
            setForm(f => ({ ...f, apellidoMaterno: e.target.value }))
          }
        />

        {/* Contacto */}
        <label className="block font-medium">Email</label>
        <input
          type="email"
          className="w-full p-2 border rounded"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />
        <label className="block font-medium">Celular</label>
        <input
          className="w-full p-2 border rounded"
          value={form.celular}
          onChange={e => setForm(f => ({ ...f, celular: e.target.value }))}
        />

        {/* Ubicación */}
        <label className="block font-medium">Ciudad</label>
        <input
          className="w-full p-2 border rounded"
          value={form.ciudad}
          onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
        />
        <label className="block font-medium">Estado</label>
        <input
          className="w-full p-2 border rounded"
          value={form.estado}
          onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
        />
        <label className="block font-medium">País</label>
        <input
          className="w-full p-2 border rounded"
          value={form.pais}
          onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
        />

        {/* Club opcional */}
        <label className="block font-medium">Club (opcional)</label>
        <input
          className="w-full p-2 border rounded"
          value={form.club}
          onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
        />

        <button
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          onClick={handleSubmit}
        >
          Registrar Competidor
        </button>
      </div>
    </TempAuthGuard>
  );
}