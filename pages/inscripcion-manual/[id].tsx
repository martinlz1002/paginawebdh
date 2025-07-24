import { useRouter } from "next/router";
import { useEffect, useState } from "react";
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
  const { id } = router.query as { id?: string };

  const [step, setStep] = useState<"login" | "form" | "expired">("login");
  const [tempUser, setTempUser] = useState<APIUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // formulario de datos
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
  const [available, setAvailable] = useState<number[]>([]);

  // login inputs
  const [login, setLogin] = useState({ username: "", password: "" });

  // 1️⃣ Cargo datos (incluyendo password) desde Firestore
  useEffect(() => {
    if (!id) return;
    fetch(`/api/get-tempusuario?id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Enlace inválido o expirado");
        return res.json();
      })
      .then((u: APIUser) => setTempUser(u))
      .catch(() => setStep("expired"));
  }, [id]);

  // 2️⃣ Login local contra tempUser.username|password
  const handleLogin = () => {
    setError(null);
    if (!tempUser) return;
    if (
      login.username === tempUser.username &&
      login.password === tempUser.password
    ) {
      // obtengo los números disponibles
      fetch(`/api/temp-avail?id=${encodeURIComponent(id!)}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("No pude calcular disponibles");
          return res.json();
        })
        .then(({ available }: { available: number[] }) => {
          setAvailable(available);
          setStep("form");
        })
        .catch((e) => setError(e.message));
    } else {
      setError("Credenciales incorrectas");
    }
  };

  // 3️⃣ Registro manual
  const handleSubmit = async () => {
    setError(null);
    if (!tempUser) return;
    try {
      await registrarInscripcionManual({
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
      });
      alert("Competidor registrado correctamente");
      // actualizo lista
      setAvailable((prev) =>
        prev.filter((n) => n !== form.competitorNumber)
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  // — renderizar según paso —
  if (step === "expired") {
    return <p className="p-6 text-center">Este enlace ha expirado.</p>;
  }

  if (step === "login") {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-2xl font-semibold mb-4">
          Login Inscripción Manual
        </h2>
        {error && <p className="text-red-600 mb-2">{error}</p>}
        <input
          className="w-full mb-3 p-2 border rounded"
          placeholder="Usuario"
          value={login.username}
          onChange={(e) =>
            setLogin((l) => ({ ...l, username: e.target.value }))
          }
        />
        <input
          className="w-full mb-4 p-2 border rounded"
          placeholder="Contraseña"
          type="password"
          value={login.password}
          onChange={(e) =>
            setLogin((l) => ({ ...l, password: e.target.value }))
          }
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
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-semibold">Inscripción Manual</h2>
      <p>
        Competidores restantes: <strong>{available.length}</strong>
      </p>
      {error && <p className="text-red-600">{error}</p>}

      {/* Número */}
      <label className="block font-medium">Número de competidor</label>
      <select
        className="w-full p-2 border rounded"
        value={form.competitorNumber}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            competitorNumber: Number(e.target.value),
          }))
        }
      >
        <option value={0}>-- elige --</option>
        {available.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      {/* Campos del competidor */}
      <label className="block font-medium">Nombre</label>
      <input
        className="w-full p-2 border rounded"
        value={form.nombre}
        onChange={(e) =>
          setForm((f) => ({ ...f, nombre: e.target.value }))
        }
      />

      <label className="block font-medium">Apellido Paterno</label>
      <input
        className="w-full p-2 border rounded"
        value={form.apellidoPaterno}
        onChange={(e) =>
          setForm((f) => ({ ...f, apellidoPaterno: e.target.value }))
        }
      />

      <label className="block font-medium">Apellido Materno</label>
      <input
        className="w-full p-2 border rounded"
        value={form.apellidoMaterno}
        onChange={(e) =>
          setForm((f) => ({ ...f, apellidoMaterno: e.target.value }))
        }
      />

      {/* Contacto */}
      <label className="block font-medium">Email</label>
      <input
        type="email"
        className="w-full p-2 border rounded"
        value={form.email}
        onChange={(e) =>
          setForm((f) => ({ ...f, email: e.target.value }))
        }
      />

      <label className="block font-medium">Celular</label>
      <input
        className="w-full p-2 border rounded"
        value={form.celular}
        onChange={(e) =>
          setForm((f) => ({ ...f, celular: e.target.value }))
        }
      />

      {/* Ubicación */}
      <label className="block font-medium">Ciudad</label>
      <input
        className="w-full p-2 border rounded"
        value={form.ciudad}
        onChange={(e) =>
          setForm((f) => ({ ...f, ciudad: e.target.value }))
        }
      />

      <label className="block font-medium">Estado</label>
      <input
        className="w-full p-2 border rounded"
        value={form.estado}
        onChange={(e) =>
          setForm((f) => ({ ...f, estado: e.target.value }))
        }
      />

      <label className="block font-medium">País</label>
      <input
        className="w-full p-2 border rounded"
        value={form.pais}
        onChange={(e) =>
          setForm((f) => ({ ...f, pais: e.target.value }))
        }
      />

      <label className="block font-medium">Club (opcional)</label>
      <input
        className="w-full p-2 border rounded"
        value={form.club}
        onChange={(e) =>
          setForm((f) => ({ ...f, club: e.target.value }))
        }
      />

      <button
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
        onClick={handleSubmit}
      >
        Registrar Competidor
      </button>
    </div>
  );
}