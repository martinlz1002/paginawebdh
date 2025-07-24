import { useRouter } from "next/router";
import { useEffect, useState } from "react";

interface APIUser {
  id: string;
  carreraId: string;
  range: { start: number; end: number };
  username: string;
  expiresAt: string;
}

type Step = "login" | "form" | "expired";

export default function ManualPage() {
  const router = useRouter();
  const raw = router.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const [step, setStep] = useState<Step>("login");
  const [apiUser, setApiUser] = useState<APIUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Login form state
  const [loginData, setLoginData] = useState({ username: "", password: "" });

  // Available numbers
  const [available, setAvailable] = useState<number[]>([]);

  // Inscription form state
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

  // 1️⃣ Al montar, obtenemos el tempUsuario público y validamos expiración
  useEffect(() => {
    if (!id) return;
    fetch(`/api/get-tempusuario?id=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Expired or not found");
        return res.json();
      })
      .then((u: APIUser) => {
        // si expiró
        if (new Date(u.expiresAt).getTime() < Date.now()) {
          setStep("expired");
        } else {
          setApiUser(u);
        }
      })
      .catch(() => {
        setStep("expired");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  // 2️⃣ Manejar login: llamar a /api/temp-login y luego cargar disponibles
  const handleLogin = async () => {
    if (!apiUser) return;
    setError(null);
    try {
      const res = await fetch("/api/temp-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Credenciales inválidas");
      }
      // Verificar que el ID coincida
      if (data.user.id !== apiUser.id) {
        throw new Error("Este usuario/contraseña no corresponde a este enlace");
      }
      // Cargar números disponibles
      const availRes = await fetch(`/api/temp-avail?id=${encodeURIComponent(id!)}`);
      const { available: nums } = await availRes.json();
      setAvailable(nums);
      setStep("form");
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 3️⃣ Envío del formulario de inscripción manual
  const handleSubmit = async () => {
    if (!apiUser) return;
    setError(null);
    if (!form.competitorNumber) {
      setError("Selecciona un número de competidor");
      return;
    }
    try {
      await fetch("/api/registrar-inscripcion-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carreraId: apiUser.carreraId,
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
        }),
      }).then(r => {
        if (!r.ok) return r.text().then(text => { throw new Error(text); });
      });
      alert("Competidor registrado correctamente");
      // actualizar lista local de disponibles
      setAvailable((a) => a.filter((n) => n !== form.competitorNumber));
      setForm((f) => ({ ...f, competitorNumber: 0 }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return <p className="text-center mt-10">Cargando…</p>;
  }
  if (step === "expired") {
    return <p className="text-center mt-10 text-red-600">Este enlace ha expirado.</p>;
  }
  if (step === "login") {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <h2 className="text-xl font-semibold">Login Inscripción Manual</h2>
        {error && <p className="text-red-600">{error}</p>}
        <input
          type="text"
          placeholder="Usuario"
          value={loginData.username}
          onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={loginData.password}
          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
          className="w-full p-2 border rounded"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Entrar
        </button>
      </div>
    );
  }
  // step === "form"
  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h2 className="text-xl font-semibold">Inscripción Manual</h2>
      {error && <p className="text-red-600">{error}</p>}

      <div>
        <label className="block font-medium">Número de Competidor</label>
        <select
          className="w-full p-2 border rounded"
          value={form.competitorNumber}
          onChange={(e) =>
            setForm((f) => ({ ...f, competitorNumber: Number(e.target.value) }))
          }
        >
          <option value={0}>-- Elige --</option>
          {available.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-medium">Nombre</label>
        <input
          className="w-full p-2 border rounded"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium">Apellido Paterno</label>
          <input
            className="w-full p-2 border rounded"
            value={form.apellidoPaterno}
            onChange={(e) =>
              setForm((f) => ({ ...f, apellidoPaterno: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="block font-medium">Apellido Materno</label>
          <input
            className="w-full p-2 border rounded"
            value={form.apellidoMaterno}
            onChange={(e) =>
              setForm((f) => ({ ...f, apellidoMaterno: e.target.value }))
            }
          />
        </div>
      </div>

      <div>
        <label className="block font-medium">Email</label>
        <input
          type="email"
          className="w-full p-2 border rounded"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>

      <div>
        <label className="block font-medium">Celular</label>
        <input
          className="w-full p-2 border rounded"
          value={form.celular}
          onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block font-medium">Ciudad</label>
          <input
            className="w-full p-2 border rounded"
            value={form.ciudad}
            onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
          />
        </div>
        <div>
          <label className="block font-medium">Estado</label>
          <input
            className="w-full p-2 border rounded"
            value={form.estado}
            onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
          />
        </div>
        <div>
          <label className="block font-medium">País</label>
          <input
            className="w-full p-2 border rounded"
            value={form.pais}
            onChange={(e) => setForm((f) => ({ ...f, pais: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="block font-medium">Club (opcional)</label>
        <input
          className="w-full p-2 border rounded"
          value={form.club}
          onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
        />
      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        Registrar Competidor
      </button>
    </div>
  );
}