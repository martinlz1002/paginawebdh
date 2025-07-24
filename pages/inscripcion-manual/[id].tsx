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
  const rawId = router.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [step, setStep] = useState<"login" | "form" | "expired">("login");
  const [tempUser, setTempUser] = useState<APIUser | null>(null);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
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

  // Si el enlace expiró (lo manejas en el login handler, o puedes pingear get-tempusuario aquí)

  // 1️⃣ Handle login contra /api/temp-login
  const handleLogin = async () => {
    setError(null);
    if (!credentials.username || !credentials.password) {
      setError("Ingresa usuario y contraseña");
      return;
    }
    try {
      const res = await fetch("/api/temp-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Autenticación fallida");
      }
      // Guardo en localStorage para persistir
      const userWithPw = { ...data.user, password: credentials.password };
      localStorage.setItem("tempUser", JSON.stringify(userWithPw));
      setTempUser(data.user);

      // 2️⃣ Cargo números disponibles
      const availRes = await fetch(`/api/temp-avail?id=${data.user.id}`);
      const availJson = await availRes.json();
      setAvailable(availJson.available);

      setStep("form");
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 3️⃣ Cuando ya estoy en form, envío la inscripción
  const handleSubmit = async () => {
    if (!tempUser) return;
    setError(null);
    if (!form.competitorNumber) {
      setError("Selecciona un número");
      return;
    }
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
      // Actualizo la lista de disponibles
      setAvailable(av => av.filter(n => n !== form.competitorNumber));
      // Opcional: limpiar el número seleccionado
      setForm(f => ({ ...f, competitorNumber: 0 }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── RENDERS ──

  if (step === "expired") {
    return <p className="p-6 text-center">Este enlace ha expirado.</p>;
  }

  if (step === "login") {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-2xl font-semibold mb-4">Login Inscripción Manual</h2>
        {error && <p className="text-red-600 mb-2">{error}</p>}
        <input
          placeholder="Usuario"
          className="w-full mb-2 p-2 border rounded"
          value={credentials.username}
          onChange={e => setCredentials(c => ({ ...c, username: e.target.value }))}
        />
        <input
          placeholder="Contraseña"
          type="password"
          className="w-full mb-4 p-2 border rounded"
          value={credentials.password}
          onChange={e => setCredentials(c => ({ ...c, password: e.target.value }))}
        />
        <button
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
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
        <h2 className="text-2xl font-semibold">Inscripción Manual</h2>
        <p>Competidores restantes: {available.length}</p>
        {error && <p className="text-red-600">{error}</p>}

        {/* Selecciona número */}
        <div>
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
        </div>

        {/* Nombre */}
        <div>
          <label className="block font-medium">Nombre</label>
          <input
            className="w-full p-2 border rounded"
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
          />
        </div>

        {/* Apellidos */}
        <div>
          <label className="block font-medium">Apellido Paterno</label>
          <input
            className="w-full p-2 border rounded"
            value={form.apellidoPaterno}
            onChange={e =>
              setForm(f => ({ ...f, apellidoPaterno: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="block font-medium">Apellido Materno</label>
          <input
            className="w-full p-2 border rounded"
            value={form.apellidoMaterno}
            onChange={e =>
              setForm(f => ({ ...f, apellidoMaterno: e.target.value }))
            }
          />
        </div>

        {/* Contacto */}
        <div>
          <label className="block font-medium">Email</label>
          <input
            type="email"
            className="w-full p-2 border rounded"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="block font-medium">Celular</label>
          <input
            className="w-full p-2 border rounded"
            value={form.celular}
            onChange={e =>
              setForm(f => ({ ...f, celular: e.target.value }))
            }
          />
        </div>

        {/* Ubicación */}
        <div>
          <label className="block font-medium">Ciudad, Estado, País</label>
          <div className="grid grid-cols-3 gap-2">
            <input
              placeholder="Ciudad"
              className="p-2 border rounded"
              value={form.ciudad}
              onChange={e =>
                setForm(f => ({ ...f, ciudad: e.target.value }))
              }
            />
            <input
              placeholder="Estado"
              className="p-2 border rounded"
              value={form.estado}
              onChange={e =>
                setForm(f => ({ ...f, estado: e.target.value }))
              }
            />
            <input
              placeholder="País"
              className="p-2 border rounded"
              value={form.pais}
              onChange={e =>
                setForm(f => ({ ...f, pais: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Club */}
        <div>
          <label className="block font-medium">Club (opcional)</label>
          <input
            className="w-full p-2 border rounded"
            value={form.club}
            onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
          />
        </div>

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