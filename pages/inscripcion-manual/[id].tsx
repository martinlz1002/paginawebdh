import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import TempAuthGuard from "@/components/TempAuthGuard";
import { registrarInscripcionManual } from "@/lib/Inscripciones";
import type { TempUsuario } from "@/types/tempusuario";

export default function ManualPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [tempUser, setTempUser] = useState<(TempUsuario & { id: string })|null>(null);
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
  const [error, setError] = useState<string|null>(null);

  // 1️⃣ Cargamos tempUser de localStorage y validamos que sea el mismo id
  useEffect(() => {
    const json = typeof window !== 'undefined' && localStorage.getItem("tempUser");
    if (!json) {
      router.replace("/temp-login");
      return;
    }
    const u = JSON.parse(json) as TempUsuario & { id: string };
    if (u.id !== id) {
      router.replace("/temp-login");
      return;
    }
    setTempUser({ ...u, expiresAt: new Date(u.expiresAt) });
  }, [id, router]);

  // 2️⃣ Calcular disponibles
  useEffect(() => {
    if (!tempUser) return;
    (async () => {
      const all = Array.from(
        { length: tempUser.range.end - tempUser.range.start + 1 },
        (_, i) => tempUser.range.start + i
      );
      const snap = await getDocs(
        query(
          collection(db, "inscripciones"),
          where("carreraId", "==", tempUser.carreraId),
          where("competitorNumber", ">=", tempUser.range.start),
          where("competitorNumber", "<=", tempUser.range.end)
        )
      );
      const used = snap.docs.map(d => d.data().competitorNumber as number);
      setAvailable(all.filter(n => !used.includes(n)));
    })();
  }, [tempUser]);

  // 3️⃣ Envío
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

  // 404 / expirado
  if (!tempUser) return null;

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
          onChange={e => setForm(f => ({ ...f, competitorNumber: Number(e.target.value) }))}
        >
          <option value={0}>-- elige --</option>
          {available.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* … resto de inputs igual que antes … */}

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