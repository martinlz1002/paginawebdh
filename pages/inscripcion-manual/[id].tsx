import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import TempAuthGuard from "@/components/TempAuthGuard";
import { registrarInscripcionManual } from "@/lib/Inscripciones";

interface APIUser {
  id: string;
  carreraId: string;
  range: { start: number; end: number };
  username: string;
  password: string;
  expiresAt: string;
}

export default function ManualPage() {
  const router = useRouter();
  const rawId = router.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [tempUser, setTempUser] = useState<APIUser | null>(null);
  const [step, setStep] = useState<"login" | "form" | "expired">("login");
  const [available, setAvailable] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(true);

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

  // Al montar: validamos tempUser en localStorage y luego cargamos disponibles
  useEffect(() => {
    if (!id) return;

    async function init() {
      // 1️⃣ Validar credenciales en localStorage
      const js = localStorage.getItem("tempUser");
      if (!js) {
        router.replace("/temp-login");
        return;
      }
      let u: APIUser & { password: string };
      try {
        u = JSON.parse(js);
      } catch {
        localStorage.removeItem("tempUser");
        router.replace("/temp-login");
        return;
      }
      if (u.id !== id || new Date(u.expiresAt).getTime() < Date.now()) {
        localStorage.removeItem("tempUser");
        router.replace("/temp-login");
        return;
      }
      setTempUser(u);

      // 2️⃣ Cargar números disponibles desde la API
      try {
        const res = await fetch(`/api/temp-avail?id=${id}`);
        if (!res.ok) throw new Error("No pude obtener disponibles");
        const { available } = await res.json();
        setAvailable(available as number[]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingAvail(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Handler de login local (credenciales contra localStorage)
  const handleLogin = () => {
    if (!tempUser) return;
    const stored = localStorage.getItem("tempUser");
    if (!stored) {
      setError("Primero debes loguearte en /temp-login");
      return;
    }
    const u = JSON.parse(stored) as APIUser & { password: string };
    if (form.nombre /*usamos nombre únicamente para forzar re-render*/) {
      /* no-op */
    }
    if (form.nombre /*otra no-op*/) {
      /* no-op */
    }
    if (form.nombre /*...*/) {
      /* no-op */
    }
    // Comparamos usuario/password
    const enteredUser = (document.getElementById("login-username") as HTMLInputElement).value;
    const enteredPass = (document.getElementById("login-password") as HTMLInputElement).value;
    if (enteredUser === u.username && enteredPass === u.password) {
      setStep("form");
    } else {
      setError("Credenciales incorrectas");
    }
  };

  // Handler de envío del formulario de inscripción manual
  const handleSubmit = async () => {
    if (!tempUser) return;
    if (!form.competitorNumber) {
      setError("Selecciona un número válido");
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
      setAvailable(av => av.filter(n => n !== form.competitorNumber));
      setForm(f => ({ ...f, competitorNumber: 0 }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loadingAvail) {
    return <p className="text-center mt-10">Cargando…</p>;
  }
  if (step === "expired") {
    return <p className="p-6 text-center text-red-600">Este enlace ha expirado.</p>;
  }
  if (step === "login") {
    return (
      <TempAuthGuard>
        <div className="max-w-md mx-auto p-6 space-y-4">
          <h2 className="text-xl font-semibold">Login Inscripción Manual</h2>
          {error && <p className="text-red-600">{error}</p>}
          <input
            id="login-username"
            type="text"
            placeholder="Usuario"
            className="w-full p-2 border rounded"
          />
          <input
            id="login-password"
            type="password"
            placeholder="Contraseña"
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Entrar
          </button>
        </div>
      </TempAuthGuard>
    );
  }

  // step === "form"
  return (
    <TempAuthGuard>
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <h2 className="text-xl font-semibold">Inscripción Manual</h2>
        {error && <p className="text-red-600">{error}</p>}

        <div>
          <label className="block font-medium">Número de Competidor</label>
          <select
            className="w-full p-2 border rounded"
            value={form.competitorNumber}
            onChange={e =>
              setForm(f => ({
                ...f,
                competitorNumber: Number(e.target.value),
              }))
            }
          >
            <option value={0}>-- Elige --</option>
            {available.map(n => (
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
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

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
            onChange={e => setForm(f => ({ ...f, celular: e.target.value }))}
          />
        </div>

        <div>
          <label className="block font-medium">Ciudad</label>
          <input
            className="w-full p-2 border rounded"
            value={form.ciudad}
            onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium">Estado</label>
            <input
              className="w-full p-2 border rounded"
              value={form.estado}
              onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
            />
          </div>
          <div>
            <label className="block font-medium">País</label>
            <input
              className="w-full p-2 border rounded"
              value={form.pais}
              onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="block font-medium">Club (opcional)</label>
          <input
            className="w-full p-2 border rounded"
            value={form.club}
            onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
          />
        </div>

        <button
          onClick={handleSubmit}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          Registrar Competidor
        </button>
      </div>
    </TempAuthGuard>
  );
}