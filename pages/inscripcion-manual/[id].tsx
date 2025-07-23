import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TempUsuario } from "@/types/tempusuario";
import { registrarInscripcionManual } from "@/lib/Inscripciones";

export default function ManualPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [step, setStep] = useState<"login" | "form" | "expired">("login");
  const [tempUser, setTempUser] = useState<TempUsuario | null>(null);
  const [user, setUser] = useState({ username: "", password: "" });
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
    competitorNumber: 0
  });
  const [available, setAvailable] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 1️⃣ Cargo el TempUsuario
  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "tempusuarios", id)).then((snap) => {
      if (!snap.exists()) {
        setStep("expired");
        return;
      }
      const data = snap.data() as any;
      const expires: Date = data.expiresAt.toDate();
      if (Date.now() > expires.getTime()) {
        setStep("expired");
        return;
      }
      setTempUser({ ...data, expiresAt: expires });
    });
  }, [id]);

  // 2️⃣ Login manual
  const handleLogin = async () => {
    if (!tempUser) return;
    if (
      user.username === tempUser.username &&
      user.password === tempUser.password
    ) {
      // Rango completo
      const allNumbers = Array.from(
        { length: tempUser.range.end - tempUser.range.start + 1 },
        (_, i) => tempUser.range.start + i
      );
      // Filtrar ya usados
      const usedSnap = await getDocs(
        query(
          collection(db, "inscripciones"),
          where("carreraId", "==", tempUser.carreraId),
          where("competitorNumber", ">=", tempUser.range.start),
          where("competitorNumber", "<=", tempUser.range.end)
        )
      );
      const used = usedSnap.docs.map((d) => d.data().competitorNumber as number);
      setAvailable(allNumbers.filter((n) => !used.includes(n)));
      setStep("form");
    } else {
      setError("Credenciales incorrectas");
    }
  };

  // 3️⃣ Registro manual
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
        paymentStatus: "manual"
      });
      alert("Competidor registrado correctamente");
      setAvailable((prev) =>
        prev.filter((n) => n !== form.competitorNumber)
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 🚧 Renders
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
          value={user.username}
          onChange={(e) =>
            setUser((u) => ({ ...u, username: e.target.value }))
          }
        />
        <input
          className="w-full mb-4 p-2 border"
          placeholder="Contraseña"
          type="password"
          value={user.password}
          onChange={(e) =>
            setUser((u) => ({ ...u, password: e.target.value }))
          }
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
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h2 className="text-xl">Inscripción Manual</h2>
      <p>Competidores restantes: {available.length}</p>
      {error && <p className="text-red-600">{error}</p>}

      <label>Número</label>
      <select
        className="w-full p-2 border"
        value={form.competitorNumber}
        onChange={(e) =>
          setForm((f) => ({ ...f, competitorNumber: Number(e.target.value) }))
        }
      >
        <option value={0}>-- elige --</option>
        {available.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

        {/* Datos del competidor */}
        <label>Nombre</label>
        <input
          className="w-full p-2 border"
          value={form.nombre}
          onChange={(e) =>
            setForm((f) => ({ ...f, nombre: e.target.value }))
          }
        />
        <label>Apellido Paterno</label>
        <input
          className="w-full p-2 border"
          value={form.apellidoPaterno}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              apellidoPaterno: e.target.value
            }))
          }
        />
        <label>Apellido Materno</label>
        <input
          className="w-full p-2 border"
          value={form.apellidoMaterno}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              apellidoMaterno: e.target.value
            }))
          }
        />

        {/* Contacto */}
        <label>Email</label>
        <input
          type="email"
          className="w-full p-2 border"
          value={form.email}
          onChange={(e) =>
            setForm((f) => ({ ...f, email: e.target.value }))
          }
        />
        <label>Celular</label>
        <input
          className="w-full p-2 border"
          value={form.celular}
          onChange={(e) =>
            setForm((f) => ({ ...f, celular: e.target.value }))
          }
        />

        {/* Ubicación */}
        <label>Ciudad, Estado, País</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            placeholder="Ciudad"
            className="p-2 border"
            value={form.ciudad}
            onChange={(e) =>
              setForm((f) => ({ ...f, ciudad: e.target.value }))
            }
          />
          <input
            placeholder="Estado"
            className="p-2 border"
            value={form.estado}
            onChange={(e) =>
              setForm((f) => ({ ...f, estado: e.target.value }))
            }
          />
          <input
            placeholder="País"
            className="p-2 border"
            value={form.pais}
            onChange={(e) =>
              setForm((f) => ({ ...f, pais: e.target.value }))
            }
          />
        </div>

        <label>Club (opcional)</label>
        <input
          className="w-full p-2 border"
          value={form.club}
          onChange={(e) =>
            setForm((f) => ({ ...f, club: e.target.value }))
          }
        />

        <button
          className="w-full bg-green-600 text-white py-2 rounded"
          onClick={handleSubmit}
        >
          Registrar Competidor
        </button>
      </div>
  );
}